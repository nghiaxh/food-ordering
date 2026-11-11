import http from '@/shared/api/http'
import type { Order, OrderStatus, Promotion, User, ChatHistoryMessage, KnowledgeChunkView, KnowledgeDoc, KnowledgeStats, AiSetting } from '@/shared/types'

/** Du lieu bieu mau quan tri tao/sua don hang. */
export interface AdminOrderPayload {
  customerEmail: string
  /** Bo trong khi chi sua thong tin giao hang cua don da xac nhan. */
  items?: { foodId?: number; quantity: number }[]
  receiverName: string
  phone: string
  /** Bo trong khi chi sua thong tin giao hang. */
  address: string
  paymentMethod: string
  note?: string
  status?: OrderStatus
  paid?: boolean
}

/** Du lieu bieu mau quan tri tao/sua tai khoan khach hang. */
export interface UserPayload {
  email: string
  fullName: string
  phone?: string
  address?: string
  /** De trong khi sua nghia la giu mat khau hien tai. */
  password?: string
}

// ----- Mon an -----
export const adminSaveFood = (id: number | null, data: object) =>
  id ? http.put(`/admin/foods/${id}`, data) : http.post('/admin/foods', data)

export const adminDeleteFood = (id: number) => http.delete(`/admin/foods/${id}`)

export const adminSaveCategory = (
  id: number | null,
  data: { name: string; slug: string; imageUrl: string; description: string },
) =>
  id ? http.put(`/admin/categories/${id}`, data) : http.post('/admin/categories', data)

export const adminDeleteCategory = (id: number) => http.delete(`/admin/categories/${id}`)

export const adminUploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return http.post<{ url: string }>('/admin/uploads/image', form).then((r) => r.data)
}

// ----- Don hang -----
export const adminGetOrders = () => http.get<Order[]>('/admin/orders').then((r) => r.data)

export const adminSaveOrder = (id: number | null, data: AdminOrderPayload) =>
  id ? http.put(`/admin/orders/${id}`, data) : http.post('/admin/orders', data)

export const adminDeleteOrder = (id: number) => http.delete(`/admin/orders/${id}`)

export const adminUpdateOrderStatus = (id: number, status: string) =>
  http.patch(`/admin/orders/${id}/status`, { status })

export const adminUpdateOrderPayment = (id: number, paid: boolean) =>
  http.patch(`/admin/orders/${id}/payment`, null, { params: { paid } })

// ----- Khach hang -----
export const adminGetUsers = () => http.get<User[]>('/admin/users').then((r) => r.data)

export const adminSaveUser = (id: number | null, data: UserPayload) =>
  id ? http.put(`/admin/users/${id}`, data) : http.post('/admin/users', data)

export const adminDeleteUser = (id: number) => http.delete(`/admin/users/${id}`)

export const adminSetUserActive = (id: number, active: boolean) =>
  http.patch(`/admin/users/${id}/active`, null, { params: { active } })

// ----- Khuyen mai -----
export const adminGetPromotions = () => http.get<Promotion[]>('/admin/promotions').then((r) => r.data)

export const adminSavePromotion = (id: number | null, data: object) =>
  id ? http.put(`/admin/promotions/${id}`, data) : http.post('/admin/promotions', data)

export const adminDeletePromotion = (id: number) => http.delete(`/admin/promotions/${id}`)

// ----- Chatbot -----
export const adminGetChatHistory = () => http.get<ChatHistoryMessage[]>('/admin/chatbot/history').then((r) => r.data)

export const adminGetSettings = () => http.get<{ settingKey: string; settingValue: string }[]>('/admin/chatbot/settings').then((r) => r.data)

export const adminSaveSetting = (settingKey: string, settingValue: string) =>
  http.put('/admin/chatbot/settings', { settingKey, settingValue })

export const adminGetDocuments = () => http.get<KnowledgeDoc[]>('/admin/chatbot/documents').then((r) => r.data)

export const adminGetDocumentStats = () => http.get<KnowledgeStats>('/admin/chatbot/documents/stats').then((r) => r.data)

export const adminGetDocumentChunks = (id: number) =>
  http.get<KnowledgeChunkView[]>(`/admin/chatbot/documents/${id}/chunks`).then((r) => r.data)

export const adminSaveDocument = (id: number | null, data: object) =>
  id
    ? http.put<KnowledgeDoc>(`/admin/chatbot/documents/${id}`, data).then((r) => r.data)
    : http.post<KnowledgeDoc>('/admin/chatbot/documents', data).then((r) => r.data)

export const adminDeleteDocument = (id: number) => http.delete(`/admin/chatbot/documents/${id}`)

export const adminUploadDocument = (file: File, title: string, category: string, keywords: string) => {
  const form = new FormData()
  form.append('file', file)
  if (title.trim()) form.append('title', title.trim())
  if (category.trim()) form.append('category', category.trim())
  if (keywords.trim()) form.append('keywords', keywords.trim())
  return http.post<KnowledgeDoc>('/admin/chatbot/documents/upload', form).then((r) => r.data)
}

export const adminReingestDocument = (id: number) =>
  http.post<KnowledgeDoc>(`/admin/chatbot/documents/${id}/reingest`, {}).then((r) => r.data)

// ----- Bao cao -----
export interface ReportSummary {
  revenue: number
  orderCount: number
  completedCount: number
  avgOrder: number
  customerCount: number
  promotionDiscount: number
}

export const adminGetReportSummary = (from?: string, to?: string) =>
  http.get<ReportSummary>('/admin/reports/summary', { params: { from, to } }).then((r) => r.data)

export const adminGetReportRevenue = (from?: string, to?: string) =>
  http.get<{ date: string; revenue: number; orders: number }[]>('/admin/reports/revenue', { params: { from, to } }).then((r) => r.data)

export const adminGetReportTopFoods = (from?: string, to?: string, limit = 10) =>
  http.get<{ name: string; quantity: number; revenue: number }[]>('/admin/reports/top-foods', { params: { from, to, limit } }).then((r) => r.data)

export const adminExportReport = (from?: string, to?: string) =>
  http.get('/admin/reports/export', { params: { from, to }, responseType: 'blob' }).then((r) => r.data)

export type { AiSetting, OrderStatus }
