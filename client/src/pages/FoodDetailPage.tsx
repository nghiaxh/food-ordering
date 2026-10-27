import { useEffect, useState } from 'react'
import { Button, Descriptions, Divider, Form, Input, InputNumber, List, Rate, Space, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { createReview, getFood, getFoods, getReviews } from '../api/api'
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
  const [food, setFood] = useState<Food>()
  const [reviews, setReviews] = useState<Review[]>([])
  const [related, setRelated] = useState<Food[]>([])
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
      message.error('Gửi đánh giá thất bại. Vui lòng thử lại.')
    }
  }

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