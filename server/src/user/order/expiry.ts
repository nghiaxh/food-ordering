import type { OrderStatus } from "./transitions.js";

export type PaymentWindow = {
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  createdAt: Date;
};

// Chi don QR chua tra tien moi het han thanh toan; COD tra khi giao nen khong tinh gio.
export const isAwaitingQrPayment = (
  order: Pick<PaymentWindow, "status" | "paymentStatus" | "paymentMethod">,
) => order.status === "PENDING" && order.paymentStatus === "UNPAID" && order.paymentMethod === "QR";

export const isExpiredUnpaidQr = (order: PaymentWindow, now: Date, timeoutMs: number) =>
  isAwaitingQrPayment(order) && now.getTime() - order.createdAt.getTime() >= timeoutMs;

/** Han tra tien de client dem nguoc; null khi don khong con cho thanh toan QR. */
export const paymentDeadlineAt = (order: PaymentWindow, timeoutMs: number): string | null =>
  isAwaitingQrPayment(order) ? new Date(order.createdAt.getTime() + timeoutMs).toISOString() : null;
