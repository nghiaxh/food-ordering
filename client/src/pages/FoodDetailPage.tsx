import { useState } from 'react'
import { message } from 'antd'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { createReview, deleteReview, getFood, getReviews, updateReview } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { formatVND } from '../utils/format'
import { spicyLabel, discountText } from '../utils/food-tags'
import { reviewStats } from '../utils/reviews'
import { apiErrorMessage } from '../utils/api-error'
import RatingStars from '../components/RatingStars'
import ReviewSection from '../components/ReviewSection'
import QuantityStepper from '../components/QuantityStepper'
import UiButton from '../components/UiButton'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'

/**
 * Trang chi tiết một món. Trước đây là Drawer phủ lên bảng món; chuyển thành trang riêng
 * để có đủ chỗ cho ảnh lớn, thông số, đánh giá và một cột mua hàng sticky.
 *
 * Giá dùng đúng một nguồn `discountedPrice ?? price`, giống thẻ món. Lỗi cũ là thẻ hiện giá
 * giảm còn trang chi tiết hiện giá gốc, khách thấy hai giá cho cùng một món.
 *
 * Quay lại ưu tiên `state.from` do thẻ món truyền vào (kèm query bộ lọc); vị trí cuộn của
 * bảng món do FoodsPage khôi phục từ sessionStorage.
 */
export default function FoodDetailPage() {
  const { id } = useParams()
  const foodId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [qty, setQty] = useState(1)
  const user = useAuthStore((s) => s.user)
  const add = useCartStore((s) => s.add)
  const openDrawer = useUiStore((s) => s.openDrawer)

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

  const { run: submitReview, pending: reviewPending } = useAsyncAction(
    (payload: { foodId: number; rating: number; comment?: string }) => createReview(payload),
  )
  const { run: editReview, pending: editPending } = useAsyncAction(
    (payload: { id: number; rating: number; comment?: string }) =>
      updateReview(payload.id, { rating: payload.rating, comment: payload.comment }),
  )
  const { run: removeReview } = useAsyncAction((id: number) => deleteReview(id))

  const goBack = () => {
    if (from) navigate(from)
    else navigate('/')
  }

  const addToCart = async () => {
    if (!food || !food.available) return
    if (!user) {
      message.info('Đăng nhập để thêm món vào giỏ')
      navigate('/login', {
        state: { from: { pathname: location.pathname, search: location.search } },
      })
      return
    }
    const ok = await add(food, qty)
    if (ok) {
      message.success(`Đã thêm ${qty} phần ${food.name} vào giỏ`)
      openDrawer('cart')
    }
  }

  const onReview = async (payload: { foodId: number; rating: number; comment?: string }) => {
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

  const onEditReview = async (id: number, payload: { rating: number; comment?: string }) => {
    const res = await editReview({ id, ...payload })
    if (res.ok) {
      message.success('Đã cập nhật đánh giá!')
      refreshReviews()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Cập nhật đánh giá thất bại.')
    }
    return res
  }

  const onDeleteReview = async (id: number) => {
    const res = await removeReview(id)
    if (res.ok) {
      message.success('Đã xóa đánh giá')
      refreshReviews()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Xóa đánh giá thất bại.')
    }
    return res
  }

  if (foodLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200/70" />
          <div className="space-y-3">
            <div className="h-8 w-2/3 animate-pulse rounded-xl bg-stone-200/70" />
            <div className="h-5 w-1/3 animate-pulse rounded-xl bg-stone-200/70" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-stone-200/70" />
          </div>
        </div>
      </div>
    )
  }

  if (foodError || !food) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-300">
          <UiIcon name="exclamation-circle" size={28} />
        </span>
        <p className="mt-4 text-lg font-semibold text-stone-900">Không tìm thấy món này</p>
        <p className="mt-1 text-sm text-stone-500">Món có thể đã bị xóa hoặc đường dẫn không đúng.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <UiButton kind="default" onClick={() => void reloadFood()}>
            Thử lại
          </UiButton>
          <UiButton kind="primary" onClick={goBack}>
            Về thực đơn
          </UiButton>
        </div>
      </div>
    )
  }

  const unit = food.discountedPrice ?? food.price
  const saving = unit < food.price ? food.price - unit : 0
  const stats = reviewStats(reviews ?? [])
  const unavailable = !food.available
  const allergens = food.allergens
    ? food.allergens.split(',').map((t) => t.trim()).filter(Boolean)
    : []
  const specs = [
    { label: 'Phân loại', value: food.category?.name ?? 'Khác' },
    { label: 'Khẩu phần', value: `${food.servingSize} người` },
    { label: 'Độ cay', value: spicyLabel(food.spicyLevel) },
    { label: 'Chế độ ăn', value: food.dietaryTags || 'Thông thường' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 pb-32 sm:px-6 lg:pb-10">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-amber-50 hover:text-amber-800"
        >
          <UiIcon name="arrow-left" size={14} />
          Quay lại thực đơn
        </button>
        <span className="hidden truncate text-xs text-stone-500 sm:inline">
          {food.category?.name ?? 'Món ăn'} / {food.name}
        </span>
      </div>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl bg-stone-100">
            <UiImg
              src={food.imageUrl}
              alt={food.name}
              preview
              className="aspect-[4/3] w-full sm:aspect-[2/1] lg:aspect-[4/3]"
            />
            {!!food.discountPercent && food.available && (
              <span className="absolute left-3 top-3 rounded-full bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white">
                -{food.discountPercent}%
              </span>
            )}
          </div>

          <div className="mt-5">
            <h2 className="text-base font-bold text-stone-900">Thông tin món</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200/60">
                  <dt className="text-xs text-stone-500">{spec.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-stone-800">{spec.value}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-4">
              <dt className="text-xs text-stone-500">Thành phần</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-stone-800">
                {food.ingredients || 'Chưa cập nhật'}
              </dd>
            </dl>

            {allergens.length > 0 && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-red-50/70 px-3.5 py-3 ring-1 ring-red-100">
                <UiIcon name="exclamation-circle" size={16} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm leading-relaxed text-red-800">
                  <span className="font-semibold">Lưu ý dị ứng:</span> {allergens.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-[28px]">
              {food.name}
            </h1>

            {stats.count > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById('danh-gia')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-stone-600 hover:text-amber-800"
              >
                <RatingStars value={Math.round(stats.avg ?? 0)} size={14} />
                <span className="font-semibold tabular-nums text-stone-900">{stats.avg?.toFixed(1)}</span>
                <span>· {stats.count} đánh giá</span>
              </button>
            )}

            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <span className="text-[26px] font-bold tabular-nums leading-none text-amber-800">
                {formatVND(unit)}
              </span>
              {saving > 0 && (
                <>
                  <span className="text-sm tabular-nums text-stone-500 line-through">
                    {formatVND(food.price)}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Tiết kiệm {formatVND(saving)}
                  </span>
                </>
              )}
            </div>
            {food.discountLabel && saving > 0 && (
              <p className="mt-1 text-xs font-medium text-emerald-700">{discountText(food.discountLabel)}</p>
            )}

            {food.description && (
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{food.description}</p>
            )}

            {unavailable ? (
              <div className="mt-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-600">
                Món đang tạm hết. Bạn có thể chọn món khác trong thực đơn.
              </div>
            ) : (
              <div className="mt-5 hidden items-center gap-3 lg:flex">
                <QuantityStepper value={qty} onChange={setQty} label={`Số lượng ${food.name}`} />
                <UiButton kind="primary-lg" className="flex-1" onClick={() => void addToCart()}>
                  Thêm vào giỏ
                </UiButton>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div id="danh-gia" className="mt-8 scroll-mt-[calc(var(--header-h)+1rem)]">
        <ReviewSection
          foodId={foodId}
          reviews={reviews}
          loading={reviewsLoading}
          error={reviewsError}
          user={user}
          submitting={reviewPending || editPending}
          onRefresh={refreshReviews}
          onSubmit={onReview}
          onUpdate={onEditReview}
          onDelete={onDeleteReview}
        />
      </div>

      {/* Thanh mua hàng cố định trên mobile để nút thêm luôn trong tầm ngón tay. */}
      {!unavailable && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <QuantityStepper
              value={qty}
              onChange={setQty}
              size="sm"
              label={`Số lượng ${food.name}`}
            />
            <UiButton kind="primary" className="min-w-0 flex-1" onClick={() => void addToCart()}>
              Thêm vào giỏ
            </UiButton>
          </div>
        </div>
      )}
    </div>
  )
}
