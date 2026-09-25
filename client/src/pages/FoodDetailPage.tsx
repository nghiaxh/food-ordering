import { useState, type ReactNode } from 'react'
import { message } from 'antd'
import { MinusOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { createReview, getFood, getFoods, getReviews } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { spicyLabel } from '../utils/food-tags'
import { reviewStats } from '../utils/reviews'
import { apiErrorMessage } from '../utils/api-error'
import FoodCard from '../components/FoodCard'
import RatingStars from '../components/RatingStars'
import ReviewSection from '../components/ReviewSection'
import SectionHeader from '../components/SectionHeader'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 md:py-12 lg:pb-12">
      <Link
        to="/foods"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-amber-700"
      >
        <UiIcon name="arrow-left" size={14} /> Quay lại thực đơn
      </Link>
      {children}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
      <div className="aspect-[4/3] animate-pulse rounded-[1.75rem] bg-stone-200/70" />
      <div className="space-y-4">
        <div className="h-9 w-2/3 animate-pulse rounded-xl bg-stone-200/70" />
        <div className="h-6 w-1/3 animate-pulse rounded-xl bg-stone-200/70" />
        <div className="h-10 w-1/2 animate-pulse rounded-xl bg-stone-200/70" />
        <div className="h-4 w-full animate-pulse rounded-xl bg-stone-200/70" />
        <div className="h-4 w-5/6 animate-pulse rounded-xl bg-stone-200/70" />
        <div className="grid grid-cols-2 gap-x-8 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-200/60" />
          ))}
          <div className="col-span-2 h-12 animate-pulse rounded-lg bg-stone-200/60" />
        </div>
      </div>
    </div>
  )
}

export default function FoodDetailPage() {
  const { id } = useParams()
  const foodId = Number(id)
  const [qty, setQty] = useState(1)
  const user = useAuthStore((s) => s.user)
  const add = useCartStore((s) => s.add)

  const {
    data: food,
    loading: foodLoading,
    error: foodError,
    refresh: reloadFood,
  } = useAsyncData((signal) => getFood(foodId, signal), [foodId])
  const {
    data: reviews,
    loading: reviewsLoading,
    error: reviewsError,
    refresh: refreshReviews,
  } = useAsyncData((signal) => getReviews(foodId, signal), [foodId])
  const { data: related } = useAsyncData(
    (signal) => (food?.category ? getFoods({ categoryId: food.category.id }, signal) : Promise.resolve([])),
    [foodId, food?.category?.id],
  )
  const { run: submitReview, pending: reviewPending } = useAsyncAction(
    (payload: { foodId: number; rating: number; comment: string }) => createReview(payload),
  )

  const addToCart = () => {
    if (!food) return
    add(food, qty)
    message.success('Đã thêm vào giỏ')
  }

  const onReview = async (payload: { foodId: number; rating: number; comment: string }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đánh giá')
      return { ok: false as const, error: new Error('Chưa đăng nhập') }
    }
    const res = await submitReview(payload)
    if (res.ok) {
      message.success('Cảm ơn bạn đã đánh giá!')
      refreshReviews()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Gửi đánh giá thất bại. Vui lòng thử lại.')
    }
    return res
  }

  if (foodLoading) {
    return (
      <Shell>
        <DetailSkeleton />
      </Shell>
    )
  }

  if (foodError || !food) {
    return (
      <Shell>
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <UiIcon name="exclamation-circle" size={28} className="text-stone-300" />
          <h2 className="mt-4 text-lg font-semibold text-stone-900">Không tải được món ăn</h2>
          <p className="mt-1 text-sm text-stone-500">Có lỗi khi lấy dữ liệu món ăn. Vui lòng thử lại.</p>
          <button
            type="button"
            onClick={reloadFood}
            className="mt-5 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.97]"
          >
            Thử lại
          </button>
        </div>
      </Shell>
    )
  }

  const relatedFoods = (related ?? []).filter((x) => x.id !== foodId).slice(0, 4)
  const stats = reviewStats(reviews ?? [])
  const unavailable = !food.available
  const allergens = food.allergens ? food.allergens.split(',').map((t) => t.trim()).filter(Boolean) : []
  const specs = [
    { label: 'Phân loại', value: food.category?.name ?? 'Khác' },
    { label: 'Khẩu phần', value: `${food.servingSize} người` },
    { label: 'Độ cay', value: spicyLabel(food.spicyLevel) },
    { label: 'Chế độ ăn', value: food.dietaryTags || 'Thông thường' },
  ]

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* Image */}
        <div className="lg:self-start">
          <div className="overflow-hidden rounded-[1.75rem] bg-stone-100">
            <UiImg src={food.imageUrl} alt={food.name} preview className="aspect-[4/3] w-full" />
          </div>
        </div>

        {/* Info */}
        <div>
          {stats.count > 0 && (
            <a
              href="#danh-gia"
              className="inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-amber-700"
            >
              <RatingStars value={Math.round(stats.avg ?? 0)} size={14} />
              <span className="font-semibold tabular-nums text-stone-800">{stats.avg?.toFixed(1)}</span>
              <span>· {stats.count} đánh giá</span>
            </a>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-stone-900 md:text-5xl">
            {food.name}
          </h1>
          <div className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-amber-700 md:text-4xl">
            {formatVND(food.price)}
          </div>

          {food.description && (
            <p className="mt-4 max-w-prose leading-relaxed text-stone-600">{food.description}</p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-x-8 border-t border-stone-100">
            {specs.map((spec) => (
              <div key={spec.label} className="border-b border-stone-100 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{spec.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-stone-800">{spec.value}</dd>
              </div>
            ))}
            <div className="col-span-2 border-b border-stone-100 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Thành phần</dt>
              <dd className="mt-0.5 text-sm font-medium leading-relaxed text-stone-800">
                {food.ingredients || 'Chưa cập nhật'}
              </dd>
            </div>
          </dl>

          {allergens.length > 0 && (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-red-50/70 px-4 py-3 ring-1 ring-red-100">
              <UiIcon name="exclamation-circle" size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-800">
                <span className="font-semibold">Lưu ý dị ứng:</span> {allergens.join(', ')}
              </p>
            </div>
          )}

          {/* Buy */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div
              className={`flex items-center overflow-hidden rounded-full ring-1 ${
                unavailable ? 'opacity-50 ring-stone-200' : 'ring-stone-200'
              }`}
            >
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className={`flex h-12 w-12 items-center justify-center transition ${
                  unavailable ? 'cursor-not-allowed text-stone-300' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <MinusOutlined />
              </button>
              <span className="w-12 text-center text-base font-semibold tabular-nums text-stone-900">{qty}</span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => q + 1)}
                className={`flex h-12 w-12 items-center justify-center transition ${
                  unavailable ? 'cursor-not-allowed text-stone-300' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <PlusOutlined />
              </button>
            </div>

            {unavailable ? (
              <button
                type="button"
                disabled
                className="inline-flex h-12 items-center rounded-full bg-stone-200 px-7 text-sm font-semibold text-stone-500"
              >
                Hết hàng
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-amber-600 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98]"
              >
                <ShoppingCartOutlined /> Thêm vào giỏ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tabular-nums text-amber-700">{formatVND(food.price)}</p>
            <p className="truncate text-xs text-stone-500">
              {qty} phần · {formatVND(Number(food.price) * qty)}
            </p>
          </div>
          {unavailable ? (
            <button
              type="button"
              disabled
              className="inline-flex h-11 items-center rounded-full bg-stone-200 px-6 text-sm font-semibold text-stone-500"
            >
              Hết hàng
            </button>
          ) : (
            <button
              type="button"
              onClick={addToCart}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98]"
            >
              <ShoppingCartOutlined /> Thêm vào giỏ
            </button>
          )}
        </div>
      </div>

      <ReviewSection
        foodId={foodId}
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        user={user}
        submitting={reviewPending}
        onRefresh={refreshReviews}
        onSubmit={onReview}
      />

      {relatedFoods.length > 0 && (
        <section className="mt-16">
          <SectionHeader align="left" title="Món liên quan" subtitle="Cùng loại với món bạn đang xem." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {relatedFoods.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        </section>
      )}
    </Shell>
  )
}