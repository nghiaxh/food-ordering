import http from '@/shared/api/http'

export const adminUpdateOrderPayment = (id: number, paid: boolean) =>
  http.patch(`/admin/orders/${id}/payment`, null, { params: { paid } })