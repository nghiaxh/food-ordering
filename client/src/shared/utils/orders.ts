import type { Order, OrderStatus } from '@/shared/types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang vận chuyển',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Tiền mặt khi nhận',
  QR: 'Thanh toán bằng mã QR',
}

/** Cac phuong thuc thanh toan ma khach va quan tri vien chon khi dat mon. */
export const PAYMENT_METHODS = [
  { label: PAYMENT_METHOD_LABEL.COD, value: 'COD' },
  { label: PAYMENT_METHOD_LABEL.QR, value: 'QR' },
]

/** Ma hoa don: tien to `FO` kem id dem 4 chu so; dung chung de hai ben hien giong nhau. */
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
  if (!next) return []
  // Trạng thái PREPARING ("Đang vận chuyển") chỉ đổi tiếp khi Hoàn thành, không cho hủy theo quy tắc hệ thống.
  const canCancel = status === 'PENDING' || status === 'CONFIRMED'
  return canCancel ? [next, 'CANCELLED'] : [next]
}

/**
 * Khach tu huy duoc don chi khi con PENDING va chua thanh toan.
 * Server ap cung rang buoc; client chi an/hien nut UX.
 */
export function canCancelOrder(order: Pick<Order, 'status' | 'paymentStatus'>): boolean {
  return order.status === 'PENDING' && order.paymentStatus !== 'PAID'
}

/** Admin chi xac nhan don QR khi khach da thanh toan; COD van xac nhan duoc truoc. */
export function canConfirmOrder(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>): boolean {
  return !(order.paymentMethod === 'QR' && order.paymentStatus === 'UNPAID')
}
