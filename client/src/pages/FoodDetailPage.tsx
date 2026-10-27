import { useState } from 'react'
import { Drawer, message } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { createReview, deleteReview, getFood, getReviews, updateReview } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { spicyLabel } from '../utils/food-tags'
import { reviewStats } from '../utils/reviews'
import { apiErrorMessage } from '../utils/api-error'
import RatingStars from '../components/RatingStars'
import ReviewSection from '../components/ReviewSection'
import UiButton from '../components/UiButton'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'

/**
 * Chi tiết món dạng panel phủ trên bảng món, không phải trang riêng: người dùng không
 * rời khỏi bảng món khi xem chi tiết. URL `/foods/:id` vẫn giữ nguyên nên thẻ món trong
 * chatbot liên kết được và nút quay lại của trình duyệt đóng được panel.
 *
 * Nội dung panel đủ các thành phần Bảng 2.22: hình, giá, trạng thái, mô tả, thành phần,
 * mức cay, nhãn chế độ ăn, chất gây dị ứng, khẩu phần, chọn số lượng, Thêm vào giỏ,
 * điểm trung bình và danh sách đánh giá.
 */
export default function FoodDetailPage() {
  const { id } = useParams()
  const foodId = Number(id)
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  // Đóng bằng state để Drawer chạy animation đóng rồi mới rời route; unmount ngay sẽ mất hiệu ứng.
  const [open, setOpen] = useState(true)
  const user = useAuthStore((s) => s.user)
  const add = useCartStore((s) => s.add)

  const close = () => setOpen(false)

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
    (payload: { foodId: number; rating: number; comment: string }) => createReview(payload),
  )
  const { run: editReview, pending: editPending } = useAsyncAction(
    (payload: { id: number; rating: number; comment: string }) =>
      updateReview(payload.id, { rating: payload.rating, comment: payload.comment }),
  )
  const { run: removeReview } = useAsyncAction((id: number) => deleteReview(id))

  const addToCart = () => {
    if (!food) return
    add(food, qty)
    message.success(`Đã thêm ${qty} phần ${food.name} vào giỏ`)
    close()
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

  const onEditReview = async (id: number, payload: { rating: number; comment: string }) => {
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

  const stats = reviewStats(reviews ?? [])
  const unavailable = !food?.available
  const allergens = food?.allergens
    ? food.allergens.split(',').map((t) => t.trim()).filter(Boolean)
    : []
  const specs = food
    ? [
        { label: 'Phân loại', value: food.category?.name ?? 'Khác' },
        { label: 'Khẩu phần', value: `${food.servingSize} người` },
        { label: 'Độ cay', value: spicyLabel(food.spicyLevel) },
        { label: 'Chế độ ăn', value: food.dietaryTags || 'Thông thường' },
      ]
    : []

  return (
    <Drawer
      open={open}
      onClose={close}
      afterOpenChange={(visible) => {
        // Chỉ điều hướng khi đã đóng xong; lúc mở thì giữ nguyên URL chi tiết.
        if (!visible) navigate('/')
      }}
      // Không dùng `size` của Drawer: giá trị đó đè lên `width` và làm panel tràn hết
      // màn hình. Chỉ cần `width`, Drawer tự co về 100% khi cửa sổ hẹp hơn.
      width={720}
      title={food ? food.name : 'Chi tiết món'}
      styles={{ body: { paddingTop: 16 } }}
    >
      {foodLoading ? (
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200/70" />
          <div className="h-8 w-2/3 animate-pulse rounded-xl bg-stone-200/70" />
          <div className="h-5 w-1/3 animate-pulse rounded-xl bg-stone-200/70" />
        </div>
      ) : foodError || !food ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
          <UiIcon name="exclamation-circle" size={28} className="text-stone-300" />
          <p className="mt-3 font-medium text-stone-900">Không tải được món ăn</p>
          <p className="mt-1 text-sm text-stone-500">Vui lòng thử lại.</p>
          <UiButton kind="default" className="mt-5" onClick={() => void reloadFood()}>
            Thử lại
          </UiButton>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-stone-100">
            <UiImg
              src={food.imageUrl}
              alt={food.name}
              preview
              className="aspect-[4/3] w-full sm:aspect-[2/1]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {stats.count > 0 && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <RatingStars value={Math.round(stats.avg ?? 0)} size={14} />
                  <span className="font-semibold tabular-nums text-stone-800">
                    {stats.avg?.toFixed(1)}
                  </span>
                  <span>· {stats.count} đánh giá</span>
                </div>
              )}
              <div className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                {formatVND(food.price)}
              </div>
            </div>
            {!food.available && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                Hết món
              </span>
            )}
          </div>

          {food.description && (
            <p className="mt-4 leading-relaxed text-stone-600">{food.description}</p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-6 border-t border-stone-100">
            {specs.map((spec) => (
              <div key={spec.label} className="border-b border-stone-100 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  {spec.label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-stone-800">{spec.value}</dd>
              </div>
            ))}
            <div className="col-span-2 border-b border-stone-100 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Thành phần
              </dt>
              <dd className="mt-0.5 text-sm font-medium leading-relaxed text-stone-800">
                {food.ingredients || 'Chưa cập nhật'}
              </dd>
            </div>
          </dl>

          {allergens.length > 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-red-50/70 px-4 py-3 ring-1 ring-red-100">
              <UiIcon name="exclamation-circle" size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-800">
                <span className="font-semibold">Lưu ý dị ứng:</span> {allergens.join(', ')}
              </p>
            </div>
          )}

          {/* Số lượng và nút thêm nằm cạnh nhau để đổi số lượng rồi thêm chỉ một lần chạm. */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex shrink-0 items-center overflow-hidden rounded-xl ring-1 ring-stone-200">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed"
              >
                <MinusOutlined />
              </button>
              <span className="w-10 text-center text-base font-semibold tabular-nums text-stone-900">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed"
              >
                <PlusOutlined />
              </button>
            </div>
            <p className="min-w-0 flex-1 text-sm font-semibold tabular-nums text-stone-700">
              {formatVND(Number(food.price) * qty)}
            </p>
            <UiButton
              kind="primary-lg"
              disabled={unavailable}
              onClick={addToCart}
              className="shrink-0"
            >
              {unavailable ? 'Hết món' : 'Thêm vào giỏ'}
            </UiButton>
          </div>

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
        </>
      )}
    </Drawer>
  )
}