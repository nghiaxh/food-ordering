import http from '@/shared/api/http'
import type { Review } from '@/shared/types'

export const getReviews = (foodId: number, signal?: AbortSignal) =>
  http.get<Review[]>(`/reviews/food/${foodId}`, { signal }).then((r) => r.data)

export const createReview = (data: { foodId: number; rating: number; comment?: string }) =>
  http.post<Review>('/reviews', data).then((r) => r.data)

/** Sua va xoa chi ap dung cho danh gia cua chinh nguoi dang dang nhap. */
export const updateReview = (id: number, data: { rating: number; comment?: string }) =>
  http.put<Review>(`/reviews/${id}`, data).then((r) => r.data)

export const deleteReview = (id: number) => http.delete(`/reviews/${id}`)
