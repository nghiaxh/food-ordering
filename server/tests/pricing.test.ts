import { describe, expect, it } from "vitest";
import type { Promotion } from "../src/db/schema.js";
import {
  bestFor,
  computeRandomPicks,
  discountAmount,
  isValid,
  matches,
  minOrderReached,
  toQuoteLine,
  type DiscountRule,
} from "../src/user/pricing/engine.js";

// 2026-11-08 la Chu nhat; cac test ngay/khung gio lay moc nay.
const NOW = new Date("2026-11-08T12:00:00+07:00");

const promo = (partial: Partial<Promotion>): Promotion =>
  ({
    id: 1,
    name: "KM",
    description: null,
    discountType: "PERCENT",
    discountValue: "10",
    maxDiscount: null,
    minOrderTotal: null,
    scope: "GLOBAL",
    targetIds: [],
    startsAt: new Date("2026-01-01T00:00:00+07:00"),
    endsAt: new Date("2026-12-31T23:59:59+07:00"),
    daysOfWeek: null,
    startTime: null,
    endTime: null,
    active: true,
    priority: 0,
    usageLimit: null,
    usedCount: 0,
    randomCount: 0,
    createdAt: new Date("2026-01-01T00:00:00+07:00"),
    ...partial,
  }) as Promotion;

const food = (id: number, categoryId: number | null) => ({
  id,
  categoryId,
  price: "50000",
  name: `Món ${id}`,
  available: true,
});

const rulesOf = (auto: Promotion[], randomPicks = new Map<number, Set<number>>()): DiscountRule => ({
  now: NOW,
  auto,
  randomPicks,
  availableFoodIds: [],
});

describe("isValid", () => {
  it("từ chối khuyến mãi chưa tới ngày bắt đầu hoặc đã hết hạn", () => {
    expect(isValid(promo({ startsAt: new Date("2026-12-01") }), NOW)).toBe(false);
    expect(isValid(promo({ endsAt: new Date("2026-01-01") }), NOW)).toBe(false);
  });

  it("từ chối khuyến mãi inactive hoặc đã hết lượt dùng", () => {
    expect(isValid(promo({ active: false }), NOW)).toBe(false);
    expect(isValid(promo({ usageLimit: 5, usedCount: 5 }), NOW)).toBe(false);
    expect(isValid(promo({ usageLimit: 5, usedCount: 4 }), NOW)).toBe(true);
  });

  it("lọc theo ngày trong tuần (không phân biệt hoa thường)", () => {
    expect(isValid(promo({ daysOfWeek: "SAT,SUN" }), NOW)).toBe(true);
    expect(isValid(promo({ daysOfWeek: "MON,TUE" }), NOW)).toBe(false);
    expect(isValid(promo({ daysOfWeek: "sun" }), NOW)).toBe(true);
  });

  it("khung giờ bình thường và khung giờ qua nửa đêm", () => {
    expect(isValid(promo({ startTime: "11:00", endTime: "13:00" }), NOW)).toBe(true);
    expect(isValid(promo({ startTime: "13:00", endTime: "14:00" }), NOW)).toBe(false);
    // Qua nua dem: 22:00 -> 02:00; 12h trua khong thuoc khung
    expect(isValid(promo({ startTime: "22:00", endTime: "02:00" }), NOW)).toBe(false);
    const lateNight = new Date("2026-11-08T23:00:00+07:00");
    expect(isValid(promo({ startTime: "22:00", endTime: "02:00" }), lateNight)).toBe(true);
  });
});

describe("discountAmount", () => {
  it("PERCENT lấy theo phần trăm của giá, làm tròn HALF_UP 2 số lẻ", () => {
    expect(discountAmount(50000, promo({ discountValue: "20" }))).toBe(10000);
    expect(discountAmount(10001, promo({ discountValue: "10" }))).toBeCloseTo(1000.1, 2);
  });

  it("FIXED lấy đúng số tiền và bị kẹp trần bởi maxDiscount", () => {
    expect(discountAmount(50000, promo({ discountType: "FIXED", discountValue: "15000" }))).toBe(15000);
    expect(
      discountAmount(50000, promo({ discountType: "FIXED", discountValue: "30000", maxDiscount: "10000" })),
    ).toBe(10000);
  });

  it("không bao giờ giảm quá giá món hoặc âm", () => {
    expect(discountAmount(5000, promo({ discountType: "FIXED", discountValue: "99999" }))).toBe(5000);
    expect(discountAmount(50000, promo({ discountType: "FIXED", discountValue: "-1" }))).toBe(0);
  });
});

describe("minOrderReached", () => {
  it("khuyến mãi không có hạn mức thì luôn áp dụng", () => {
    expect(minOrderReached(promo({ minOrderTotal: null }), 0)).toBe(true);
  });

  it("khuyến mãi có hạn mức chỉ áp khi tổng đơn đạt mức", () => {
    const limited = promo({ minOrderTotal: "100000" });
    expect(minOrderReached(limited, 99999)).toBe(false);
    expect(minOrderReached(limited, 100000)).toBe(true);
    expect(minOrderReached(limited, 150000)).toBe(true);
  });
});

describe("matches / bestFor", () => {
  const lunch = promo({ id: 10, scope: "CATEGORY", targetIds: [2], name: "Trưa" });
  const globalPromo = promo({ id: 20, scope: "GLOBAL", name: "Toàn menu" });
  const foodPromo = promo({ id: 30, scope: "FOOD", targetIds: [7], name: "Món riêng" });

  it("khớp theo phạm vi GLOBAL/CATEGORY/FOOD", () => {
    expect(matches(globalPromo, food(7, 2))).toBe(true);
    expect(matches(lunch, food(7, 2))).toBe(true);
    expect(matches(lunch, food(7, 3))).toBe(false);
    expect(matches(foodPromo, food(7, 3))).toBe(true);
    expect(matches(foodPromo, food(8, 3))).toBe(false);
  });

  it("chọn giảm nhiều nhất; hoà số tiền thì priority cao hơn thắng", () => {
    const best = bestFor(50000, food(7, 2), rulesOf([
      promo({ id: 1, scope: "GLOBAL", discountValue: "10", priority: 0, name: "10%" }),
      promo({ id: 2, scope: "GLOBAL", discountValue: "30", priority: 0, name: "30%" }),
    ]));
    expect(best?.name).toBe("30%");

    const tie = bestFor(50000, food(7, 2), rulesOf([
      promo({ id: 1, scope: "GLOBAL", discountValue: "10", priority: 1, name: "thấp điểm ưu tiên" }),
      promo({ id: 2, scope: "GLOBAL", discountValue: "10", priority: 9, name: "cao điểm ưu tiên" }),
    ]));
    expect(tie?.name).toBe("cao điểm ưu tiên");
  });

  it("KM randomCount chỉ áp cho món được băm trúng trong ngày", () => {
    const random = promo({ id: 99, scope: "GLOBAL", randomCount: 1 });
    const picks = computeRandomPicks([random], [7, 8, 9], NOW);
    const picked = picks.get(99);
    expect(picked?.size).toBe(1);
    const inPick = bestFor(50000, food([...picked!][0]!, 1), rulesOf([random], picks));
    expect(inPick?.id).toBe(99);

    const notPickedIds = [7, 8, 9].filter((id) => !picked!.has(id));
    expect(bestFor(50000, food(notPickedIds[0]!, 1), rulesOf([random], picks))).toBeNull();
  });

  it("randomCount ổn định trong cùng một ngày", () => {
    const random = promo({ id: 42, scope: "GLOBAL", randomCount: 2 });
    const a = computeRandomPicks([random], [1, 2, 3, 4, 5], NOW);
    const b = computeRandomPicks([random], [1, 2, 3, 4, 5], new Date(NOW.getTime() + 3600_000));
    expect([...a.get(42)!]).toEqual([...b.get(42)!]);
  });
});

describe("toQuoteLine", () => {
  it("tính thành tiền từng dòng (giá × số lượng − giảm giá của cả dòng)", () => {
    expect(
      toQuoteLine({
        foodId: 1,
        name: "Phở bò",
        imageUrl: null,
        unitPrice: 65000,
        lineDiscount: 13000,
        quantity: 2,
        discountLabel: "Cuối tuần",
      }),
    ).toEqual({
      foodId: 1,
      name: "Phở bò",
      imageUrl: null,
      unitPrice: 65000,
      lineDiscount: 13000,
      quantity: 2,
      lineTotal: 117000,
      discountLabel: "Cuối tuần",
    });
  });
});
