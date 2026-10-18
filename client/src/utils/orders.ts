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