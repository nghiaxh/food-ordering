import http from '@/shared/api/http'
import type { Order, SavedAddress } from '@/shared/types'

export const createOrder = (data: {
  items: { foodId?: number; quantity: number }[]
  receiverName: string
  phone: string
  address: string
  paymentMethod: string
  note?: string
}) => http.post<Order>('/orders', data).then((r) => r.data)

export const getMyOrders = (signal?: AbortSignal) =>
  http.get<Order[]>('/orders/my', { signal }).then((r) => r.data)

/** Chỉ đơn còn chờ xác nhận mới hủy được; server trả lỗi nếu đơn đã vào chế biến. */
export const cancelOrder = (id: number) => http.patch<Order>(`/orders/${id}/cancel`).then((r) => r.data)

/** Thanh toán giả lập: khách tự xác nhận đã trả. */
export const payOrder = (id: number) => http.patch<Order>(`/orders/${id}/pay`).then((r) => r.data)

export interface AddressPayload {
  label?: string
  receiverName: string
  phone: string
  address: string
  isDefault?: boolean
}

export const getAddresses = (signal?: AbortSignal) =>
  http.get<SavedAddress[]>('/addresses', { signal }).then((r) => r.data)

export const saveAddress = (id: number | null, data: AddressPayload) =>
  id
    ? http.put<SavedAddress>(`/addresses/${id}`, data).then((r) => r.data)
    : http.post<SavedAddress>('/addresses', data).then((r) => r.data)

export const deleteAddress = (id: number) => http.delete(`/addresses/${id}`)
