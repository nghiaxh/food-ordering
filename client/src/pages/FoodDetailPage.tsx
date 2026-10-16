import { useEffect, useState } from 'react'
import { Button, Descriptions, Divider, Form, Input, InputNumber, List, Rate, Space, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { createReview, getFood, getFoods, getReviews } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { foodChips } from '../utils/food-tags'
import { apiErrorMessage } from '../utils/api-error'
import FoodCard from '../components/FoodCard'
import SectionHeader from '../components/SectionHeader'
import UiImg from '../components/UiImg'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-28 md:pt-12">
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
        <div className="grid grid-cols-1 gap-x-8 pt-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-200/60" />
          ))}
          <div className="col-span-1 h-12 animate-pulse rounded-lg bg-stone-200/60 sm:col-span-2" />
        </div>
      </div>
    </div>
  )
}

export default function FoodDetailPage() {
  const { id } = useParams()
  const foodId = Number(id)
  const [food, setFood] = useState<Food>()
  const [reviews, setReviews] = useState<Review[]>([])
  const [related, setRelated] = useState<Food[]>([])
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
    getFood(foodId).then((f) => {
      setFood(f)
      if (f.category) {
        getFoods({ categoryId: f.category.id })
          .then((list) => setRelated(list.filter((x) => x.id !== foodId).slice(0, 4)))
          .catch(() => undefined)
      }
    })
    loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodId])

  if (!food) return null

  const relatedFoods = (related ?? []).filter((x) => x.id !== foodId).slice(0, 4)

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
      message.error(apiErrorMessage(res.error) ?? 'Gửi đánh giá thất bại. Vui lòng thử lại.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link to="/foods" className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-amber-700">
        <ArrowLeftOutlined /> Quay lại thực đơn
      </Link>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <UiImg
              src={food.imageUrl}
              alt={food.name}
              preview
              imgClass="h-full min-h-[260px] w-full object-cover"
              className="lg:max-h-[460px]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {food.category && <Tag color="amber">{food.category.name}</Tag>}
              {food.available ? (
                <Tag color="green">Đang phục vụ</Tag>
              ) : (
                <Tag color="red">Ngừng phục vụ</Tag>
              )}
            </div>
            <Typography.Title level={2} style={{ marginTop: 12, marginBottom: 8 }}>
              {food.name}
            </Typography.Title>
            <Typography.Title level={3} type="danger" style={{ margin: 0 }} className="!text-amber-700">
              {formatVND(food.price)}
            </Typography.Title>

            <Descriptions column={1} size="small" className="mt-6" labelStyle={{ color: '#78716c', width: 130 }}>
              <Descriptions.Item label="Mô tả">{food.description || '—'}</Descriptions.Item>
              <Descriptions.Item label="Thành phần">{food.ingredients || '—'}</Descriptions.Item>
              <Descriptions.Item label="Khẩu phần">Phục vụ khoảng {food.servingSize} người</Descriptions.Item>
              <Descriptions.Item label="Độ cay">{SPICY[food.spicyLevel]}</Descriptions.Item>
              <Descriptions.Item label="Chế độ ăn">
                {food.dietaryTags
                  ? food.dietaryTags.split(',').map((t) => <Tag key={t} color="green">{t}</Tag>)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Lưu ý dị ứng">
                {food.allergens
                  ? food.allergens.split(',').map((t) => <Tag key={t} color="orange">{t}</Tag>)
                  : 'Không có'}
              </Descriptions.Item>
            </Descriptions>

          {/* Nút mua nằm ở thanh cố định đáy để chỉ có một CTA ở mọi cỡ màn hình. */}
        </div>
      </div>

      {/* Thanh mua cố định: giá, số lượng và nút thêm, dùng chung desktop lẫn mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tabular-nums text-amber-700">{formatVND(food.price)}</p>
            <p className="truncate text-xs text-stone-500">
              {qty} phần · {formatVND(Number(food.price) * qty)}
            </p>
          </div>

          <div
            className={`flex shrink-0 items-center overflow-hidden rounded-full ring-1 ${
              unavailable ? 'opacity-50 ring-stone-200' : 'ring-stone-200'
            }`}
          >
            <button
              type="button"
              aria-label="Giảm số lượng"
              disabled={unavailable}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed"
            >
              <MinusOutlined />
            </button>
            <span className="w-10 text-center text-base font-semibold tabular-nums text-stone-900">{qty}</span>
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

          {unavailable ? (
            <button
              type="button"
              disabled
              className="inline-flex h-11 shrink-0 items-center rounded-full bg-stone-200 px-6 text-sm font-semibold text-stone-500"
            >
              Hết hàng
            </button>
          ) : (
            <button
              type="button"
              onClick={addToCart}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98]"
            >
              <ShoppingCartOutlined /> Thêm vào giỏ
            </button>
          )}
        </div>
      </div>

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

      <List
        dataSource={reviews}
        locale={{ emptyText: 'Chưa có đánh giá nào' }}
        renderItem={(r) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space>
                  <span className="font-medium text-stone-900">{r.userName}</span>
                  <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleString('vi-VN')}
                  </Typography.Text>
                </Space>
              }
              description={r.comment || 'Không có nhận xét'}
            />
          </List.Item>
        )}
      />

      {related.length > 0 && (
        <div className="mt-14">
          <SectionHeader align="left" title="Món liên quan" subtitle="Cùng loại với món bạn đang xem." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}