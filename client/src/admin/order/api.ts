import http from '@/shared/api/http'
import type { Order, OrderStatus } from '@/shared/types'

export interface AdminOrderPayload {
  customerEmail: string
  items?: { foodId?: number; quantity: number }[]
  receiverName: string
  phone: string
  address: string
  paymentMethod: string
  note?: string
  status?: OrderStatus
  paid?: boolean
}

export const adminGetOrders = () => http.get<Order[]>('/admin/orders').then((r) => r.data)

export const adminSaveOrder = (id: number | null, data: AdminOrderPayload) =>
  id ? http.put(`/admin/orders/${id}`, data) : http.post('/admin/orders', data)

export const adminDeleteOrder = (id: number) => http.delete(`/admin/orders/${id}`)

export const adminUpdateOrderStatus = (id: number, status: string) =>
  http.patch(`/admin/orders/${id}/status`, { status })