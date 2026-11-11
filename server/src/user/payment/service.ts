// Xu ly thanh toan gia lap cua khach: xac nhan da tra tien cho don chua huy.
import { badRequest } from "../../lib/errors.js";
import { toOrderJson } from "../../lib/serializers.js";
import { ownOrder, updatePayment } from "../order/service.js";

export async function payOrder(email: string, id: number) {
  const order = await ownOrder(email, id);
  if (order.status === "CANCELLED") {
    throw badRequest("Đơn đã hủy thì không thanh toán được");
  }
  const updated = await updatePayment(order, true);
  return toOrderJson(updated);
}