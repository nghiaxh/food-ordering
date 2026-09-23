import { useEffect, useState } from 'react'
import { Button, Form, Input, Rate, message } from 'antd'
import { ArrowLeftOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { createReview, getFood, getFoods, getReviews } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { foodChips } from '../utils/food-tags'
import FoodCard from '../components/FoodCard'
import SectionHeader from '../components/SectionHeader'
import UiImg from '../components/UiImg'

export default function FoodDetailPage() {
  const { id } = useParams()
  const foodId = Number(id)
  const [qty, setQty] = useState(1)
  const user = useAuthStore((s) => s.user)
  const add = useCartStore((s) => s.add)

  const { data: food, error: foodError } = useAsyncData(
    (signal) => getFood(foodId, signal),
    [foodId],
  )
  const { data: reviews, refresh: refreshReviews } = useAsyncData(
    (signal) => getReviews(foodId, signal),
    [foodId],
  )
  const { data: related } = useAsyncData(
    (signal) => (food?.category ? getFoods({ categoryId: food.category.id }, signal) : Promise.resolve([])),
    [foodId, food?.category?.id],
  )
  const { run: submitReview, pending: reviewPending } = useAsyncAction(
    (payload: { foodId: number; rating: number; comment: string }) => createReview(payload),
  )

  useEffect(() => {
    if (foodError) message.error('Không tải được món ăn')
  }, [foodError])

  if (!food) return null

  const relatedFoods = (related ?? []).filter((x) => x.id !== foodId).slice(0, 4)

  const tags = foodChips(food)

  const allergens = (food.allergens ? food.allergens.split(',').map((t) => t.trim()).filter(Boolean) : [])

  const onReview = async (v: { rating: number; comment: string }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đánh giá')
      return
    }
    const res = await submitReview({ foodId, ...v })
    if (res.ok) {
      message.success('Cảm ơn bạn đã đánh giá!')
      void refreshReviews()
    } else {
      message.error('Gửi đánh giá thất bại. Vui lòng thử lại.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link to="/foods" className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-amber-700">
        <ArrowLeftOutlined /> Quay lại thực đơn
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-3xl bg-stone-100 shadow-sm ring-1 ring-stone-200/60">
            <UiImg
              src={food.imageUrl}
              alt={food.name}
              preview
              imgClass="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>

        {/* Info */}
        <div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">{food.name}</h1>
          <div className="mt-3 text-3xl font-bold text-amber-700">{formatVND(food.price)}</div>

          {food.description && (
            <p className="mt-5 leading-relaxed text-stone-600">{food.description}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                food.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${food.available ? 'bg-green-500' : 'bg-red-500'}`} />
              {food.available ? 'Đang phục vụ' : 'Ngừng phục vụ'}
            </span>
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${tag.className}`}
              >
                {tag.label}
              </span>
            ))}
          </div>

          {/* Info list */}
          <dl className="mt-7 space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Thành phần</dt>
              <dd className="mt-1 text-stone-700">{food.ingredients || 'Không có'}</dd>
            </div>
            {allergens.length > 0 && (
              <div className="border-t border-stone-100 pt-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Lưu ý dị ứng</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {allergens.map((a) => (
                    <span key={a} className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      {a}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          {/* Buy */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full ring-1 ring-stone-200">
              <button
                type="button"
                aria-label="Giảm số lượng"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-l-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <MinusOutlined />
              </button>
              <span className="w-12 text-center text-base font-semibold tabular-nums text-stone-900">{qty}</span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-r-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <PlusOutlined />
              </button>
            </div>

            <Button
              type="primary"
              size="large"
              className="!h-11 !px-6"
              icon={<ShoppingCartOutlined />}
              disabled={!food.available}
              onClick={() => {
                add(food, qty)
                message.success('Đã thêm vào giỏ')
              }}
            >
              Thêm vào giỏ
            </Button>
            {!food.available && (
              <span className="text-sm text-stone-500">Món này hiện đang tạm ngừng phục vụ.</span>
            )}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-16">
        <SectionHeader align="left" title="Đánh giá & nhận xét" />

        {user ? (
          <Form layout="vertical" onFinish={onReview} className="mb-8 !max-w-lg">
            <Form.Item name="rating" label="Số sao" rules={[{ required: true, message: 'Chọn số sao' }]}>
              <Rate />
            </Form.Item>
            <Form.Item name="comment" label="Nhận xét">
              <Input.TextArea rows={3} placeholder="Món ăn thế nào? Chia sẻ cảm nhận của bạn..." />
            </Form.Item>
            <Button htmlType="submit" type="primary" loading={reviewPending}>Gửi đánh giá</Button>
          </Form>
        ) : (
          <p className="mb-8 text-stone-500">
            <Link to="/login" className="text-amber-700 hover:underline">Đăng nhập</Link> để gửi đánh giá cho món này.
          </p>
        )}

        {reviews && reviews.length > 0 ? (
          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
            {reviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">{r.userName}</span>
                  <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
                  <span className="text-xs text-stone-400">
                    {new Date(r.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-stone-600">{r.comment || 'Không có nhận xét'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-stone-500">Chưa có đánh giá nào cho món này.</p>
        )}
      </section>

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
    </div>
  )
}