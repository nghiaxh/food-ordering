import { describe, expect, it } from "vitest";
import { adminOrderSchema } from "../src/admin/order/schema.js";
import { isCreatableStatus } from "../src/user/order/transitions.js";

// Rang buoc bien cua DTO don hang phia admin: cung kiem soat voi don cua khach.
const base = {
  customerEmail: "khach@example.com",
  items: [{ foodId: 1, quantity: 1 }],
  receiverName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "12 Nguyễn Văn Cừ, Cần Thơ",
  paymentMethod: "COD",
};

describe("adminOrderSchema", () => {
  it("chấp nhận payload hợp lệ", () => {
    expect(adminOrderSchema.safeParse(base).success).toBe(true);
    expect(adminOrderSchema.safeParse({ ...base, paymentMethod: "QR" }).success).toBe(true);
  });

  it("SĐT đúng 10 chữ số bắt đầu bằng 0", () => {
    expect(adminOrderSchema.safeParse({ ...base, phone: "123456789" }).success).toBe(false);
    expect(adminOrderSchema.safeParse({ ...base, phone: "1901234567" }).success).toBe(false);
    expect(adminOrderSchema.safeParse({ ...base, phone: "09012345678" }).success).toBe(false);
    expect(adminOrderSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
  });

  it("items rỗng vẫn hợp lệ: đơn không đổi món", () => {
    expect(adminOrderSchema.safeParse({ ...base, items: [] }).success).toBe(true);
    const { items, ...rest } = base;
    expect(adminOrderSchema.safeParse(rest).success).toBe(true);
  });
});

describe("isCreatableStatus", () => {
  it("chỉ cho tạo đơn ở trạng thái đi được từ PENDING", () => {
    expect(isCreatableStatus("PENDING")).toBe(true);
    expect(isCreatableStatus("CONFIRMED")).toBe(true);
    expect(isCreatableStatus("CANCELLED")).toBe(true);
  });

  it("không cho tạo đơn nhảy cóc qua PREPARING/COMPLETED", () => {
    expect(isCreatableStatus("PREPARING")).toBe(false);
    expect(isCreatableStatus("COMPLETED")).toBe(false);
  });
});
