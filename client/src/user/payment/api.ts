import http from '@/shared/api/http'
import type { Order } from '@/shared/types'

export const payOrder = (id: number) => http.patch<Order>(`/orders/${id}/pay`).then((r) => r.data)