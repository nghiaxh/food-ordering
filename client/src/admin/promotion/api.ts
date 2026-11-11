import http from '@/shared/api/http'
import type { Promotion } from '@/shared/types'

export const adminGetPromotions = () => http.get<Promotion[]>('/admin/promotions').then((r) => r.data)

export const adminSavePromotion = (id: number | null, data: object) =>
  id ? http.put(`/admin/promotions/${id}`, data) : http.post('/admin/promotions', data)

export const adminDeletePromotion = (id: number) => http.delete(`/admin/promotions/${id}`)