import { describe, expect, it } from "vitest";
import { promotionRequestSchema } from "../src/admin/promotion/schema.js";

// Rang buoc bien cua DTO khuyen mai phia admin.
const base = {
  name: "Khuyến mãi",
  discountType: "PERCENT",
  discountValue: 10,
  scope: "GLOBAL",
  startsAt: "2026-01-01T00:00:00.000Z",
  endsAt: "2026-12-31T00:00:00.000Z",
  active: true,
  priority: 0,
  randomCount: 0,
};

describe("promotionRequestSchema", () => {
  it("chấp nhận phạm vi toàn thực đơn không cần mục áp dụng", () => {
    expect(promotionRequestSchema.safeParse(base).success).toBe(true);
  });

  it("phạm vi theo danh mục/món phải chọn ít nhất một mục", () => {
    expect(promotionRequestSchema.safeParse({ ...base, scope: "CATEGORY" }).success).toBe(false);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "CATEGORY", targetIds: [] }).success).toBe(false);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "CATEGORY", targetIds: [3] }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, scope: "FOOD", targetIds: [7] }).success).toBe(true);
  });

  it("giới hạn lượt dùng 0 nghĩa là không giới hạn", () => {
    expect(promotionRequestSchema.safeParse({ ...base, usageLimit: 0 }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, usageLimit: null }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, usageLimit: -1 }).success).toBe(false);
  });

  it("hạn mức đơn tối thiểu không được âm", () => {
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: 100000 }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: null }).success).toBe(true);
    expect(promotionRequestSchema.safeParse({ ...base, minOrderTotal: -1 }).success).toBe(false);
  });

  it("thời gian kết thúc phải sau thời gian bắt đầu", () => {
    const flipped = {
      ...base,
      startsAt: "2026-12-31T00:00:00.000Z",
      endsAt: "2026-01-01T00:00:00.000Z",
    };
    expect(promotionRequestSchema.safeParse(flipped).success).toBe(false);
  });
});
