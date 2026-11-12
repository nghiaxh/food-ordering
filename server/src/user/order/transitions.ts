export type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED";
import { badRequest } from "../../lib/errors.js";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang vận chuyển",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

/** Mon chi thay duoc khi don con cho xac nhan va chua thu tien. */
export const canEditItems = (order: { status: OrderStatus; paymentStatus: string }) =>
  order.status === "PENDING" && order.paymentStatus === "UNPAID";

/** Mot quy tac chuyen trang thai dung chung cho moi loi vao. */
// Luat chuyen trang thai don hang mot chieu; tach khoi service de test doc lap khong can DB.
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "COMPLETED" || from === "CANCELLED") return false;
  if (to === "CANCELLED") return true;
  switch (from) {
    case "PENDING":
      return to === "CONFIRMED";
    case "CONFIRMED":
      return to === "PREPARING";
    case "PREPARING":
      return to === "COMPLETED";
    default:
      return false;
  }
}

/**
 * Trang thai duoc phep luc TAO don moi: don luon bat dau o PENDING nen chi tao duoc
 * trang thai PENDING, CONFIRMED (duyet ngay) hoac CANCELLED; tao thang PREPARING/COMPLETED
 * se bo qua cac buoc trong vong doi don.
 */
export function isCreatableStatus(status: OrderStatus): boolean {
  return status === "PENDING" || isValidTransition("PENDING", status);
}

export const parseStatus = (status: string): OrderStatus => {
  if (["PENDING", "CONFIRMED", "PREPARING", "COMPLETED", "CANCELLED"].includes(status)) {
    return status as OrderStatus;
  }
  throw badRequest("Trạng thái đơn không hợp lệ");
};
