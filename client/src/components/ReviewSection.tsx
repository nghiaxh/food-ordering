import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser, Review } from '../types'
import type { AsyncActionResult } from '../hooks/useAsyncAction'
import { formatRelativeTime } from '../utils/format'
import { RATING_LABELS, reviewStats, reviewerInitials } from '../utils/reviews'
import RatingStars from './RatingStars'
import SectionHeader from './SectionHeader'
import UiIcon from './UiIcon'

interface ReviewSectionProps {
  foodId: number
  reviews?: Review[]
  loading?: boolean
  error?: unknown
  user: AuthUser | null
  submitting?: boolean
  onRefresh: () => void
  onSubmit: (payload: { foodId: number; rating: number; comment: string }) => Promise<AsyncActionResult<Review>>
}

const FILTERS = [5, 4, 3, 2, 1]

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200/60 ${className}`} />
}

export default function ReviewSection({
  foodId,
  reviews = [],
  loading = false,
  error = null,
  user,
  submitting = false,
  onRefresh,
  onSubmit,
}: ReviewSectionProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [filter, setFilter] = useState(0)

  const stats = reviewStats(reviews)
  const filtered = filter > 0 ? reviews.filter((r) => r.rating === filter) : reviews
  const canSubmit = rating > 0 && comment.trim().length > 0 && !submitting

  const submit = async () => {
    if (!canSubmit) return
    const res = await onSubmit({ foodId, rating, comment: comment.trim() })
    if (res.ok) {
      setRating(0)
      setComment('')
    }
  }

  return (
    <section id="danh-gia" className="mt-14 scroll-mt-24">
      <SectionHeader align="left" title="Đánh giá & nhận xét" />

      {loading ? (
        <div className="space-y-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
          <UiIcon name="exclamation-circle" size={22} className="text-stone-300" />
          <p className="mt-3 text-sm text-stone-600">Không tải được đánh giá.</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.97]"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {reviews.length > 0 && (
            <div className="rounded-2xl border border-stone-200/70 bg-white p-5">
              <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="text-4xl font-bold tracking-tight tabular-nums text-stone-900">
                    {stats.avg?.toFixed(1)}
                  </span>
                  <span className="pb-1 text-sm text-stone-400">/5</span>
                  <RatingStars value={Math.round(stats.avg ?? 0)} size={15} className="pb-1" />
                  <span className="pb-1 text-sm text-stone-500">{stats.count} đánh giá</span>
                </div>
                <div className="space-y-1 sm:border-l sm:border-stone-100 sm:pl-8">
                  {FILTERS.map((star) => {
                    const n = stats.perStar[star] ?? 0
                    const pct = stats.count > 0 ? (n / stats.count) * 100 : 0
                    const active = filter === star
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFilter(active ? 0 : star)}
                        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-0.5 transition ${
                          active ? 'bg-amber-50' : 'hover:bg-stone-100'
                        }`}
                      >
                        <span className={`w-3.5 text-xs tabular-nums ${active ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
                          {star}
                        </span>
                        <UiIcon name="star-fill" size={10} className={active ? 'text-amber-500' : 'text-stone-300'} />
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                          <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-5 text-right text-xs tabular-nums text-stone-400">{n}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {user ? (
            <div className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <RatingStars value={rating} onChange={setRating} size={20} />
                <span className="text-sm font-medium text-amber-700">
                  {rating > 0 ? RATING_LABELS[rating] : 'Chọn số sao'}
                </span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-400">{comment.length}/500</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Chia sẻ cảm nhận của bạn..."
                className="mt-2.5 w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-stone-400">Chỉ đánh giá được món đã đặt và nhận đơn hoàn thành.</p>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submit()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-4">
              <p className="text-sm text-stone-600">
                Đăng nhập để chia sẻ đánh giá của bạn.{' '}
                <Link to="/login" className="font-semibold text-amber-700 hover:underline">
                  Đăng nhập
                </Link>
              </p>
            </div>
          )}

          {reviews.length > 0 ? (
            <>
              {filter > 0 && (
                <div className="mt-4 flex items-center justify-between text-xs">
                  <p className="text-stone-500">
                    Đang xem {filter} sao · {filtered.length} đánh giá
                  </p>
                  <button type="button" onClick={() => setFilter(0)} className="font-medium text-amber-700 hover:underline">
                    Bỏ lọc
                  </button>
                </div>
              )}
              {filtered.length > 0 ? (
                <div className={`divide-y divide-stone-100 ${filter > 0 ? '' : 'mt-5'}`}>
                  {filtered.map((r) => (
                    <article key={r.id} className="flex items-start gap-3 py-4 first:pt-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-xs font-bold text-stone-600 ring-1 ring-stone-200/60">
                        {reviewerInitials(r.userName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-stone-900">{r.userName}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-700">
                            <UiIcon name="check" size={9} /> Đã đặt hàng
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <RatingStars value={r.rating} size={13} />
                          <time className="text-[11px] text-stone-400">{formatRelativeTime(r.createdAt)}</time>
                        </div>
                        {r.comment && <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{r.comment}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                  Chưa có đánh giá {filter} sao.{' '}
                  <button type="button" onClick={() => setFilter(0)} className="font-medium text-amber-700 hover:underline">
                    Xem tất cả
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-xl text-stone-400 ring-1 ring-stone-200/70">
                <UiIcon name="message" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-stone-900">Chưa có đánh giá cho món này</h3>
              <p className="mt-0.5 text-sm text-stone-500">Hãy là người đầu tiên chia sẻ cảm nhận về món ăn này.</p>
              {user ? (
                <Link
                  to="/foods"
                  className="mt-4 rounded-full bg-amber-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500 active:scale-[0.97]"
                >
                  Khám phá thực đơn
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="mt-4 rounded-full bg-stone-900 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.97]"
                >
                  Đăng nhập để đánh giá
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}