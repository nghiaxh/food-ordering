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