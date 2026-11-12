import { describe, expect, it } from "vitest";
import {
  canEditItems,
  isValidTransition,
  ORDER_STATUS_LABEL,
  parseStatus,
} from "../src/user/order/transitions.js";

// Vong doi don: PENDING -> CONFIRMED -> PREPARING -> COMPLETED, CANCELLED tu moi trang thai chua chot.
describe("isValidTransition", () => {
  it("đi đúng một chiều theo quy trình", () => {
    expect(isValidTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(isValidTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidTransition("PREPARING", "COMPLETED")).toBe(true);
  });

  it("không cho nhảy cóc hoặc đi lùi", () => {
    expect(isValidTransition("PENDING", "PREPARING")).toBe(false);
    expect(isValidTransition("PENDING", "COMPLETED")).toBe(false);
    expect(isValidTransition("CONFIRMED", "PENDING")).toBe(false);
    expect(isValidTransition("PREPARING", "CONFIRMED")).toBe(false);
  });

  it("CANCELLED hợp lệ từ mọi trạng thái chưa chốt, không hợp lệ từ COMPLETED/CANCELLED", () => {
    expect(isValidTransition("PENDING", "CANCELLED")).toBe(true);
    expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(isValidTransition("PREPARING", "CANCELLED")).toBe(true);
    expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(isValidTransition("CANCELLED", "PENDING")).toBe(false);
    expect(isValidTransition("COMPLETED", "PREPARING")).toBe(false);
  });
});

describe("canEditItems", () => {
  it("chỉ sửa được món khi đơn PENDING và chưa thanh toán", () => {
    expect(canEditItems({ status: "PENDING", paymentStatus: "UNPAID" })).toBe(true);
    expect(canEditItems({ status: "PENDING", paymentStatus: "PAID" })).toBe(false);
    expect(canEditItems({ status: "CONFIRMED", paymentStatus: "UNPAID" })).toBe(false);
    expect(canEditItems({ status: "COMPLETED", paymentStatus: "UNPAID" })).toBe(false);
  });
});

describe("parseStatus + ORDER_STATUS_LABEL", () => {
  it("tên hiển thị giữ nhãn tiếng Việt", () => {
    expect(ORDER_STATUS_LABEL.PREPARING).toBe("Đang vận chuyển");
    expect(ORDER_STATUS_LABEL.PENDING).toBe("Chờ xác nhận");
  });

  it("parse trạng thái không hợp lệ thì báo lỗi tiếng Việt", () => {
    expect(parseStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(() => parseStatus("SHIPPING")).toThrowError(/Trạng thái đơn không hợp lệ/);
  });
});
