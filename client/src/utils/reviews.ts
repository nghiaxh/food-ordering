import type { Review } from '../types'

export const RATING_LABELS = ['', 'Dở tệ', 'Không ngon', 'Bình thường', 'Ngon', 'Tuyệt vời'] as const

export interface ReviewStats {
  avg: number | null
  count: number
  perStar: Record<number, number>
}

export function reviewStats(reviews: Review[]): ReviewStats {
  const perStar: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  for (const r of reviews) {
    perStar[r.rating] = (perStar[r.rating] ?? 0) + 1
    total += r.rating
  }
  if (reviews.length === 0) return { avg: null, count: 0, perStar }
  return { avg: total / reviews.length, count: reviews.length, perStar }
}

export function reviewerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}