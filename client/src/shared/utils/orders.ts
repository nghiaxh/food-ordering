import type { Order, OrderStatus } from '@/shared/types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang vận chuyển',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

/**
 * Nhan phuong thuc thanh toan. He thong chi ho tro hai cach tra tien: tien mat khi nhan
 * (`COD`) va quet ma QR (`QR`). Nhan nam o mot cho de trang khach va trang quan tri hien
 * giong nhau, khong lo ma thoi ra giao dien.
 */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Tiền mặt khi nhận',
  QR: 'Thanh toán bằng mã QR',
}

/** Cac phuong thuc thanh toan ma khach va quan tri vien chon khi dat mon. */
export const PAYMENT_METHODS = [
  { label: PAYMENT_METHOD_LABEL.COD, value: 'COD' },
  { label: PAYMENT_METHOD_LABEL.QR, value: 'QR' },
]

/**
 * Ma hoa don hien thi cho khach va quan tri vien: tien to `FO` kem id dem 4 chu so.
 * Mot cho sinh ma de hai ben khong lech nhau; id do server cap nen khong can doi du lieu.
 */
export function orderCode(id: number): string {
  return `FO-${String(id).padStart(4, '0')}`
}

/** Trinh tu quy trinh cua mot don; Huy la nhanh ngoai nen khong nam trong day nay. */
export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED']

/** Trang thai ke tiep hop le, hoac null khi don da chot. Server cung kiem tra lai quy tac nay. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status)
  if (i < 0 || i === ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[i + 1]
}

/** Cac trang thai ma quan tri vien co the chuyen toi tu trang thai hien tai. */
export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  const next = nextStatus(status)
  return next ? [next, 'CANCELLED'] : []
}

/**
 * Khach tu huy duoc don chi khi con cho xac nhan va chua thanh toan; true khi du dieu kien.
 * OrderService.cancel ap cung rang buoc o server nen client chi an nut UX, khong quyet dinh rieng.
 */
export function canCancelOrder(order: Pick<Order, 'status' | 'paymentStatus'>): boolean {
  return order.status === 'PENDING' && order.paymentStatus !== 'PAID'
}
