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

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

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