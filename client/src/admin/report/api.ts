import http from '@/shared/api/http'

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