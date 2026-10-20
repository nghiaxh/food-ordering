import type { OrderStatus } from '../types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chế biến',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'gold',
  CONFIRMED: 'blue',
  PREPARING: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

/**
 * Nhãn phương thức thanh toán. Hệ thống chỉ hỗ trợ hai cách trả tiền: tiền mặt khi nhận
 * (`COD`) và quét mã QR (`QR`). Nhãn nằm ở một chỗ để trang khách và trang quản trị hiện
 * giống nhau, không lộ mã thôi ra giao diện.
 */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Tiền mặt khi nhận',
  QR: 'Thanh toán bằng mã QR',
}

/** Các phương thức thanh toán mà khách và quản trị viên chọn khi đặt món. */
export const PAYMENT_METHODS = [
  { label: PAYMENT_METHOD_LABEL.COD, value: 'COD' },
  { label: PAYMENT_METHOD_LABEL.QR, value: 'QR' },
]

/** Trình tự quy trình của một đơn; Hủy là nhánh ngoài nên không nằm trong dãy này. */
export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED']

/** Trạng thái kế tiếp hợp lệ, hoặc null khi đơn đã chốt. Server cũng kiểm tra lại quy tắc này. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status)
  if (i < 0 || i === ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[i + 1]
}

/** Các trạng thái mà quản trị viên có thể chuyển tới từ trạng thái hiện tại. */
export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  const next = nextStatus(status)
  return next ? [next, 'CANCELLED'] : []
}