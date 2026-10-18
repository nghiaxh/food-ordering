import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser, Review } from '../types'
import type { AsyncActionResult } from '../hooks/useAsyncAction'
import { formatRelativeTime } from '../utils/format'
import { RATING_LABELS, reviewStats, reviewerInitials } from '../utils/reviews'
import RatingStars from './RatingStars'
import SectionHeader from './SectionHeader'
import UiButton from './UiButton'
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
  onUpdate: (id: number, payload: { rating: number; comment: string }) => Promise<AsyncActionResult<Review>>
  onDelete: (id: number) => Promise<AsyncActionResult<unknown>>
}

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
  onUpdate,
  onDelete,
}: ReviewSectionProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  // Đánh giá đang sửa; cùng một biểu mẫu dùng cho tạo mới và cập nhật.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const stats = reviewStats(reviews)
  const canSubmit = rating > 0 && comment.trim().length > 0 && !submitting

  const resetForm = () => {
    setRating(0)
    setComment('')
    setEditingId(null)
  }

  const startEdit = (review: Review) => {
    setEditingId(review.id)
    setRating(review.rating)
    setComment(review.comment ?? '')
  }

  const submit = async () => {
    if (!canSubmit) return
    const res = editingId === null
      ? await onSubmit({ foodId, rating, comment: comment.trim() })
      : await onUpdate(editingId, { rating, comment: comment.trim() })
    if (res.ok) resetForm()
  }

  const remove = async (review: Review) => {
    setDeletingId(review.id)
    const res = await onDelete(review.id)
    setDeletingId(null)
    // Đang sửa chính đánh giá vừa xóa thì đóng luôn biểu mẫu.
    if (res.ok && editingId === review.id) resetForm()
  }

  return (
    <section className="mt-10">
      <SectionHeader align="left" title="Đánh giá & nhận xét" />

      {loading ? (
        <div className="space-y-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
          <UiIcon name="exclamation-circle" size={22} className="text-stone-300" />
          <p className="mt-3 text-sm text-stone-600">Không tải được đánh giá.</p>
          <UiButton kind="default" className="mt-4" onClick={onRefresh}>
            Thử lại
          </UiButton>
        </div>
      ) : (
        <>
          {/* Bảng 2.22 chỉ yêu cầu điểm trung bình và các đánh giá, nên không vẽ thêm
              biểu đồ phân bố theo sao. */}
          {reviews.length > 0 && (
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-5 py-4">
              <span className="text-4xl font-bold tracking-tight tabular-nums text-stone-900">
                {stats.avg?.toFixed(1)}
              </span>
              <span className="pb-1 text-sm text-stone-400">/5</span>
              <RatingStars value={Math.round(stats.avg ?? 0)} size={15} className="pb-1" />
              <span className="pb-1 text-sm text-stone-500">{stats.count} đánh giá</span>
            </div>
          )}

          {user ? (
            <div className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-4 sm:p-5">
              {editingId !== null && (
                <p className="mb-3 text-xs font-medium text-amber-700">Đang sửa đánh giá của bạn</p>
              )}
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
                <p className="text-xs text-stone-400">
                  {editingId === null ? 'Chỉ đánh giá được món đã đặt và nhận đơn hoàn thành.' : ' '}
                </p>
                <div className="flex items-center gap-2">
                  {editingId !== null && (
                    <UiButton kind="default" onClick={resetForm}>
                      Hủy
                    </UiButton>
                  )}
                  <UiButton
                    kind="primary"
                    disabled={!canSubmit}
                    loading={submitting}
                    onClick={() => void submit()}
                  >
                    {editingId === null ? 'Gửi đánh giá' : 'Lưu thay đổi'}
                  </UiButton>
                </div>
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
            <div className="mt-4 divide-y divide-stone-100">
              {reviews.map((r) => (
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
                      {/* Chỉ đánh giá của chính người đang xem mới có nút thao tác. */}
                      {r.mine && (
                        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="text-amber-700 hover:underline"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => void remove(r)}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === r.id ? 'Đang xóa' : 'Xóa'}
                          </button>
                        </span>
                      )}
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
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-xl text-stone-400 ring-1 ring-stone-200/70">
                <UiIcon name="message" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-stone-900">Chưa có đánh giá cho món này</h3>
              <p className="mt-0.5 text-sm text-stone-500">Hãy là người đầu tiên chia sẻ cảm nhận về món ăn này.</p>
              {user ? (
                <Link
                  to="/"
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