import { describe, expect, it } from "vitest";
import {
  isAwaitingQrPayment,
  isExpiredUnpaidQr,
  paymentDeadlineAt,
  type PaymentWindow,
} from "../src/user/order/expiry.js";

const MINUTE = 60_000;
const TIMEOUT = 30 * MINUTE;
const CREATED = new Date("2026-01-01T10:00:00Z");

const order = (over: Partial<PaymentWindow> = {}): PaymentWindow => ({
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "QR",
  createdAt: CREATED,
  ...over,
});

const at = (minutes: number) => new Date(CREATED.getTime() + minutes * MINUTE);

// Chi don QR chua thanh toan moi bi tu huy; COD tra khi giao nen khong tinh gio.
describe("isExpiredUnpaidQr", () => {
  it("đơn QR chưa thanh toán quá 30 phút thì hết hạn", () => {
    expect(isExpiredUnpaidQr(order(), at(31), TIMEOUT)).toBe(true);
  });

  it("chưa đủ 30 phút thì còn hạn", () => {
    expect(isExpiredUnpaidQr(order(), at(29), TIMEOUT)).toBe(false);
  });

  it("đúng mốc 30 phút tính là hết hạn", () => {
    expect(isExpiredUnpaidQr(order(), at(30), TIMEOUT)).toBe(true);
  });

  it("bỏ qua COD, đơn đã trả tiền và đơn đã qua PENDING", () => {
    expect(isExpiredUnpaidQr(order({ paymentMethod: "COD" }), at(31), TIMEOUT)).toBe(false);
    expect(isExpiredUnpaidQr(order({ paymentStatus: "PAID" }), at(31), TIMEOUT)).toBe(false);
    expect(isExpiredUnpaidQr(order({ status: "CONFIRMED" }), at(31), TIMEOUT)).toBe(false);
    expect(isExpiredUnpaidQr(order({ status: "CANCELLED" }), at(31), TIMEOUT)).toBe(false);
  });
});

describe("isAwaitingQrPayment", () => {
  it("chỉ đúng tổ hợp PENDING + UNPAID + QR", () => {
    expect(isAwaitingQrPayment(order())).toBe(true);
    expect(isAwaitingQrPayment(order({ paymentMethod: "COD" }))).toBe(false);
    expect(isAwaitingQrPayment(order({ status: "PREPARING" }))).toBe(false);
  });
});

describe("paymentDeadlineAt", () => {
  it("hạn = lúc tạo đơn + 30 phút cho đơn QR chưa trả tiền", () => {
    expect(paymentDeadlineAt(order(), TIMEOUT)).toBe("2026-01-01T10:30:00.000Z");
  });

  it("null với đơn không còn chờ thanh toán QR", () => {
    expect(paymentDeadlineAt(order({ paymentMethod: "COD" }), TIMEOUT)).toBeNull();
    expect(paymentDeadlineAt(order({ paymentStatus: "PAID" }), TIMEOUT)).toBeNull();
  });
});
