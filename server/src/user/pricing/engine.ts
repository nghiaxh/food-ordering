import { createHash } from "node:crypto";
import type { Food, Promotion } from "../../db/schema.js";
import { businessTimeParts } from "../../lib/businessTime.js";

// Tinh tien o server: nguon duy nhat ve gia va khuyen mai tu dong.
// Moi dong chon MOT khuyen mai tu dong tot nhat; khung gio qua nua dem hieu start > end.
export interface PricingInputItem {
  foodId: number | null;
  quantity: number;
}

export interface DiscountRule {
  now: Date;
  /** Khuyen mai dang chay da qua vong loc isValid. */
  auto: Promotion[];
  /** Mon duoc chon ngau nhien moi ngay cho cac KM co randomCount > 0 (on dinh trong ngay). */
  randomPicks: Map<number, Set<number>>;
  availableFoodIds: number[];
}

export type FoodLike = Pick<Food, "id" | "categoryId" | "price" | "name" | "available"> & {
  category?: { id: number } | null;
};

/** Khuyen mai con hieu luc tai `now`: active, thoi gian bat dau/ket thuc, ngay, khung gio, usageLimit. */
export function isValid(p: Promotion, now: Date): boolean {
  if (!p.active) return false;
  if (now < p.startsAt || now > p.endsAt) return false;
  // Ngay/thu/gio so theo gio Viet Nam. may chu thuong chay UTC.
  const { weekday, minutes } = businessTimeParts(now);
  if (p.daysOfWeek && p.daysOfWeek.trim()) {
    const ok = p.daysOfWeek.split(",").some((d) => d.trim().toUpperCase() === weekday);
    if (!ok) return false;
  }
  if (p.startTime && p.endTime) {
    const start = toMinutes(p.startTime);
    const end = toMinutes(p.endTime);
    if (start == null || end == null) return true;
    if (start <= end) {
      // Khung gio binh thuong trong ngay.
      if (minutes < start || minutes > end) return false;
    } else {
      // Khung qua nua dem: [start, 24h) hoac [0, end].
      if (minutes < start && minutes > end) return false;
    }
  }
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return false;
  return true;
}

/**
 * Khuyen mai co han muc toi thieu chi ap khi tong don dat han.
 * Tien lai: dong hang hay theo don nen phai tinh tong don truoc khi chon khuyen mai.
 */
export function minOrderReached(p: Pick<Promotion, "minOrderTotal">, subtotal: number): boolean {
  return p.minOrderTotal == null || subtotal >= Number(p.minOrderTotal);
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** So tien giam cua mot dong theo khuyen mai; PERCENT chia theo 100 lam tron HALF_UP. */
export function discountAmount(basePrice: number, p: Pick<Promotion, "discountType" | "discountValue" | "maxDiscount">): number {
  let amount: number;
  if (p.discountType === "PERCENT") {
    // Lam tron HALF_UP o dung 2 chu so le nhu BigDecimal(...).divide(100, 2, HALF_UP).
    amount = Math.round(basePrice * Number(p.discountValue)) / 100;
  } else {
    amount = Number(p.discountValue);
  }
  if (p.maxDiscount != null && amount > Number(p.maxDiscount)) amount = Number(p.maxDiscount);
  if (amount > basePrice) amount = basePrice;
  if (amount < 0) amount = 0;
  return amount;
}

/** pham vi GLOBAL/CATEGORY/FOOD - chuong trinh GLOBAL ap cho moi mon. */
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

/** Chon khuyen mai tot nhat cho mot dong: giam nhieu nhat, hoa thi priority cao hon. */
export function bestFor(
  unitPrice: number,
  food: FoodLike,
  rules: DiscountRule,
): Promotion | null {
  let best: Promotion | null = null;
  let bestAmount = 0;
  for (const p of rules.auto) {
    if (!matches(p, food)) continue;
    // Don toi thieu tinh theo gia mot phan: mon re hon nguong thi khong duoc huong KM.
    if (p.minOrderTotal != null && unitPrice < Number(p.minOrderTotal)) continue;
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

/** Bam on dinh theo (mon, KM, ngay) - cung ngay moi request ra cung ket qua, khong can scheduler. */
export function dailyPick(foodId: number, promotionId: number, day: string): number {
  const hash = createHash("sha256").update(`${foodId}:${promotionId}:${day}`).digest("hex");
  return parseInt(hash.slice(0, 12), 16);
}

/** Danh sach mon duoc uu dai ngau nhien moi ngay (sap theo bam, lay `randomCount` mon dau). */
export function computeRandomPicks(
  auto: Pick<Promotion, "id" | "randomCount">[],
  availableFoodIds: number[],
  now: Date,
): Map<number, Set<number>> {
  // Khoa "ngay" theo lich VN de khop khai niem "moi ngay" cua khach, khong theo ngay UTC.
  const day = businessTimeParts(now).dayKey;
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
