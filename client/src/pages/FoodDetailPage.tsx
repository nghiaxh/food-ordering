import { useEffect, useState } from 'react'
import { Button, Descriptions, Divider, Form, Input, InputNumber, List, Rate, Space, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { createReview, getFood, getFoods, getReviews } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import FoodCard from '../components/FoodCard'
import SectionHeader from '../components/SectionHeader'
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

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <UiImg
              src={food.imageUrl}
              alt={food.name}
              preview
              className="aspect-[4/3] w-full"
            />
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

          <dl className="mt-8 grid grid-cols-1 gap-x-8 border-t border-stone-100 sm:grid-cols-2">
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
            <Typography.Title level={2} style={{ marginTop: 12, marginBottom: 8 }}>
              {food.name}
            </Typography.Title>
            <Typography.Title level={3} type="danger" style={{ margin: 0 }} className="!text-amber-700">
              {formatVND(food.price)}
            </Typography.Title>

            <Descriptions column={1} size="small" className="mt-6" labelStyle={{ color: '#78716c', width: 130 }}>
              <Descriptions.Item label="Mô tả">{food.description || 'Không có'}</Descriptions.Item>
              <Descriptions.Item label="Thành phần">{food.ingredients || 'Không có'}</Descriptions.Item>
              <Descriptions.Item label="Khẩu phần">Phục vụ khoảng {food.servingSize} người</Descriptions.Item>
              <Descriptions.Item label="Độ cay">{SPICY[food.spicyLevel]}</Descriptions.Item>
              <Descriptions.Item label="Chế độ ăn">
                {food.dietaryTags
                  ? food.dietaryTags.split(',').map((t) => <Tag key={t} color="green">{t}</Tag>)
                  : 'Không có'}
              </Descriptions.Item>
              <Descriptions.Item label="Lưu ý dị ứng">
                {food.allergens
                  ? food.allergens.split(',').map((t) => <Tag key={t} color="orange">{t}</Tag>)
                  : 'Không có'}
              </Descriptions.Item>
            </Descriptions>

            <Space className="mt-8" size="middle">
              <InputNumber min={1} value={qty} onChange={(v) => setQty(v ?? 1)} />
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                disabled={!food.available}
                onClick={() => {
                  add(food, qty)
                  message.success('Đã thêm vào giỏ')
                }}
              >
                Thêm vào giỏ
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <Divider>Đánh giá & nhận xét</Divider>

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

      {relatedFoods.length > 0 && (
        <div className="mt-14">
          <SectionHeader align="left" title="Món liên quan" subtitle="Cùng loại với món bạn đang xem." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {relatedFoods.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}