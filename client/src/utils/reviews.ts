import type { Review } from '../types'

export const RATING_LABELS = ['', 'Dở tệ', 'Không ngon', 'Bình thường', 'Ngon', 'Tuyệt vời'] as const

export interface ReviewStats {
  avg: number | null
  count: number
}

export function reviewStats(reviews: Review[]): ReviewStats {
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  if (reviews.length === 0) return { avg: null, count: 0 }
  return { avg: total / reviews.length, count: reviews.length }
}

export function reviewerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}