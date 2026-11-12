import { describe, expect, it } from "vitest";
import { promotionRequestSchema } from "../src/admin/promotion/schema.js";

// Rang buoc pham vi khuyen mai: CATEGORY/FOOD phai chi dich danh muc/mon cu the.
const base = {
  name: "Khuyến mãi",
  discountType: "PERCENT" as const,
  discountValue: 10,
  scope: "GLOBAL" as const,
  startsAt: new Date("2026-01-01T00:00:00+07:00"),
  endsAt: new Date("2026-12-31T23:59:59+07:00"),
  active: true,
  priority: 0,
  randomCount: 0,
};

describe("promotionRequestSchema", () => {
  it("GLOBAL không cần targetIds", () => {
    expect(promotionRequestSchema.safeParse(base).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, targetIds: [] }).success).toBe(true);
  });

  it("CATEGORY/FOOD phải có ít nhất một targetIds", () => {
    expect(promotionRequestSchema.safeParse({ ...base, scope: "CATEGORY", targetIds: [] }).success).toBe(false);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "FOOD" }).success).toBe(false);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "CATEGORY", targetIds: [1, 2] }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "FOOD", targetIds: [3] }).success).toBe(true);
  });

  it("minOrderTotal phải dương khi có", () => {
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: 100000 }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: null }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: 0 }).success).toBe(false);
  });
});
