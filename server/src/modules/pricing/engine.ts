// Tính tiền ở server — nguồn duy nhất về giá và khuyến mãi tự động. Client không tự
// nhân phần trăm hay trừ khuyến mãi; đơn tạo ra dùng đúng hàm này nên số khách thấy và
// số ghi vào đơn không thể lệch nhau.
//
// Luật: mỗi dòng chọn MỘT khuyến mãi tự động tốt nhất đang chạy (GLOBAL/CATEGORY/FOOD),
// hoà số tiền giảm thì xét priority. Khung giờ qua nửa đêm được hiểu start > end.

import { createHash } from "node:crypto";
import type { Food, Promotion } from "../../generated/prisma/client.js";

export interface PricingInputItem {
  foodId: number | null;
  quantity: number;
}

export interface DiscountRule {
  now: Date;
  /** Khuyến mãi đang chạy đã qua vòng lọc isValid. */
  auto: Promotion[];
  /** Món được chọn ngẫu nhiên mỗi ngày cho các KM có randomCount > 0 (ổn định trong ngày). */
  randomPicks: Map<number, Set<number>>;
  availableFoodIds: number[];
}

export type FoodLike = Pick<Food, "id" | "categoryId" | "price" | "name" | "available"> & {
  category?: { id: number } | null;
};

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** Khuyến mãi còn hiệu lực tại `now`: active, thời gian bắt đầu/kết thúc, ngày, khung giờ, usageLimit. */
export function isValid(p: Promotion, now: Date): boolean {
  if (!p.active) return false;
  if (now < p.startsAt || now > p.endsAt) return false;
  if (p.daysOfWeek && p.daysOfWeek.trim()) {
    const today = DAYS[now.getDay()] ?? "SUN";
    const ok = p.daysOfWeek.split(",").some((d) => d.trim().toUpperCase() === today);
    if (!ok) return false;
  }
  if (p.startTime && p.endTime) {
    const t = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(p.startTime);
    const end = toMinutes(p.endTime);
    if (start == null || end == null) return true;
    if (start <= end) {
      // Khung giờ bình thường trong ngày.
      if (t < start || t > end) return false;
    } else {
      // Khung qua nửa đêm: [start, 24h) ∪ [0, end].
      if (t < start && t > end) return false;
    }
  }
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return false;
  return true;
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Số tiền giảm của một dòng theo khuyến mãi; PERCENT chia theo 100 làm tròn HALF_UP. */
export function discountAmount(basePrice: number, p: Pick<Promotion, "discountType" | "discountValue" | "maxDiscount">): number {
  let amount: number;
  if (p.discountType === "PERCENT") {
    // Làm tròn HALF_UP ở đúng 2 chữ số lẻ như BigDecimal(...).divide(100, 2, HALF_UP).
    amount = Math.round(basePrice * Number(p.discountValue)) / 100;
  } else {
    amount = Number(p.discountValue);
  }
  if (p.maxDiscount != null && amount > Number(p.maxDiscount)) amount = Number(p.maxDiscount);
  if (amount > basePrice) amount = basePrice;
  if (amount < 0) amount = 0;
  return amount;
}

/** phạm vi GLOBAL/CATEGORY/FOOD — chương trình GLOBAL áp cho mọi món. */
export function matches(p: Pick<Promotion, "scope" | "targetIds">, food: FoodLike): boolean {
  switch (p.scope) {
    case "GLOBAL":
      return true;
    case "CATEGORY":
      return food.categoryId != null && p.targetIds.includes(food.categoryId);
    case "FOOD":
      return p.targetIds.includes(food.id);
    default:
      return false;
  }
}

/** Chọn khuyến mãi tốt nhất cho một dòng: giảm nhiều nhất, hoà thì priority cao hơn. */
export function bestFor(
  unitPrice: number,
  food: FoodLike,
  rules: DiscountRule,
): Promotion | null {
  let best: Promotion | null = null;
  let bestAmount = 0;
  for (const p of rules.auto) {
    if (!matches(p, food)) continue;
    if (p.randomCount > 0) {
      const picked = rules.randomPicks.get(p.id);
      if (!picked || !picked.has(food.id)) continue;
    }
    const amount = discountAmount(unitPrice, p);
    if (amount <= 0) continue;
    if (
      !best ||
      amount > bestAmount ||
      (amount === bestAmount && p.priority > best.priority)
    ) {
      best = p;
      bestAmount = amount;
    }
  }
  return best;
}

/** Băm ổn định theo (món, KM, ngày) — cùng ngày mọi request ra cùng kết quả, không cần scheduler. */
export function dailyPick(foodId: number, promotionId: number, day: string): number {
  const hash = createHash("sha256").update(`${foodId}:${promotionId}:${day}`).digest("hex");
  return parseInt(hash.slice(0, 12), 16);
}

/** Danh sách món được ưu đãi ngẫu nhiên mỗi ngày (sắp theo băm, lấy `randomCount` món đầu). */
export function computeRandomPicks(
  auto: Pick<Promotion, "id" | "randomCount">[],
  availableFoodIds: number[],
  now: Date,
): Map<number, Set<number>> {
  const day = now.toISOString().slice(0, 10);
  const picks = new Map<number, Set<number>>();
  for (const p of auto) {
    if (p.randomCount <= 0) continue;
    const picked = [...availableFoodIds]
      .sort((a, b) => dailyPick(a, p.id, day) - dailyPick(b, p.id, day) || a - b)
      .slice(0, p.randomCount);
    picks.set(p.id, new Set(picked));
  }
  return picks;
}

export const toQuoteLine = (
  line: {
    foodId: number | null;
    name: string;
    imageUrl: string | null;
    unitPrice: number;
    lineDiscount: number;
    quantity: number;
    discountLabel: string | null;
  },
) => ({
  foodId: line.foodId,
  name: line.name,
  imageUrl: line.imageUrl,
  unitPrice: line.unitPrice,
  lineDiscount: line.lineDiscount,
  quantity: line.quantity,
  lineTotal: line.unitPrice * line.quantity - line.lineDiscount,
  discountLabel: line.discountLabel,
});
