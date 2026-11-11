import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../src/modules/order/schema.js";

// Rang buoc bien cua DTO tao don (port cua OrderDtosValidationTest).
const base = {
  items: [{ foodId: 1, quantity: 1 }],
  receiverName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "12 Nguyễn Văn Cừ, Cần Thơ",
  paymentMethod: "COD",
};

describe("createOrderSchema", () => {
  it("chấp nhận payload hợp lệ", () => {
    expect(createOrderSchema.safeParse(base).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, paymentMethod: "QR" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, note: "Ít cay" }).success).toBe(true);
  });

  it("giỏ hàng không được rỗng", () => {
    expect(createOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("số lượng món phải >= 1", () => {
    expect(createOrderSchema.safeParse({ ...base, items: [{ foodId: 1, quantity: 0 }] }).success).toBe(false);
  });

  it("phương thức thanh toán chỉ COD|QR", () => {
    expect(createOrderSchema.safeParse({ ...base, paymentMethod: "BANK" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, paymentMethod: "cod" }).success).toBe(false);
  });

  it("SĐT đúng 10 chữ số bắt đầu bằng 0", () => {
    expect(createOrderSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, phone: "1901234567" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, phone: "09012345678" }).success).toBe(false);
  });

  it("ghi chú tối đa 255 ký tự", () => {
    expect(createOrderSchema.safeParse({ ...base, note: "a".repeat(255) }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, note: "a".repeat(256) }).success).toBe(false);
  });

  it("receiverName và address không được rỗng", () => {
    expect(createOrderSchema.safeParse({ ...base, receiverName: "" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, address: "" }).success).toBe(false);
  });
});
