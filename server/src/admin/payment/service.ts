import { updatePayment } from "../../user/order/service.js";

// Admin cap nhat trang thai thanh toan cua don.
export const updatePaymentStatus = (
  order: { id: number; user?: { id: number } | null; userId?: number; paymentStatus: string },
  paid: boolean,
  client?: Parameters<typeof updatePayment>[2],
) => updatePayment(order, paid, client);