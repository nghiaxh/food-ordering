import { Button, Empty, Form, Input, Radio, Skeleton, message } from 'antd'
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import UiImg from '../components/UiImg'

export default function CartPage() {
  const { items, loaded, setQuantity, remove, clear, count, total } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { run: submitOrder, pending: submitting } = useAsyncAction(
    (payload: {
      items: { foodId: number; quantity: number }[]
      receiverName: string
      phone: string
      address: string
      paymentMethod: string
    }) => createOrder(payload),
  )

  const submit = async (v: { receiverName: string; phone: string; address: string; paymentMethod: string }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đặt món')
      navigate('/login')
      return
    }
    if (submitting) return
    const res = await submitOrder({
      ...v,
      items: items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    })
    if (res.ok) {
      message.success('Đặt món thành công!')
      clear()
      navigate('/orders')
    } else {
      message.error(
        typeof res.error === 'object' &&
          res.error !== null &&
          'response' in res.error
          ? String(
              (res.error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                'Đặt món thất bại',
            )
          : 'Đặt món thất bại',
      )
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton active />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Empty description="Giỏ hàng của bạn đang trống">
          <Link to="/foods">
            <Button type="primary">Khám phá thực đơn</Button>
          </Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-stone-900">Giỏ hàng</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Item list */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
          <div className="border-b border-stone-100 px-5 py-3 text-sm font-medium text-stone-500">
            {count()} món trong giỏ
          </div>
          {items.map((i) => (
            <div
              key={i.food.id}
              className="flex items-center gap-4 border-b border-stone-100 px-5 py-4 last:border-b-0"
            >
              <Link to={`/foods/${i.food.id}`} className="shrink-0">
                <UiImg
                  src={i.food.imageUrl}
                  alt={i.food.name}
                  imgClass="h-20 w-20 rounded-xl object-cover"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/foods/${i.food.id}`}
                  className="block truncate font-medium text-stone-800 hover:text-amber-700"
                >
                  {i.food.name}
                </Link>
                <div className="mt-0.5 text-sm text-stone-500">{formatVND(i.food.price)} / phần</div>
                {!i.food.available && (
                  <div className="mt-1 text-xs font-medium text-red-600">Tạm hết</div>
                )}
              </div>

              <div className="flex items-center rounded-full ring-1 ring-stone-200">
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={i.quantity <= 1}
                  onClick={() => setQuantity(i.food.id, i.quantity - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-l-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MinusOutlined style={{ fontSize: 12 }} />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  onClick={() => setQuantity(i.food.id, i.quantity + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-r-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                >
                  <PlusOutlined style={{ fontSize: 12 }} />
                </button>
              </div>

              <div className="w-24 text-right font-semibold tabular-nums text-stone-900">
                {formatVND(i.food.price * i.quantity)}
              </div>

              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label="Xóa món"
                onClick={() => remove(i.food.id)}
              />
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-5 py-4">
            <span className="text-sm text-stone-500">Tạm tính</span>
            <span className="text-lg font-bold tabular-nums text-amber-700">{formatVND(total())}</span>
          </div>
        </div>

        {/* Checkout */}
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-96">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <h2 className="text-lg font-bold text-stone-900">Thông tin giao hàng</h2>
            <Form
              layout="vertical"
              onFinish={submit}
              className="mt-4"
              initialValues={{ receiverName: user?.fullName, paymentMethod: 'COD' }}
            >
              <Form.Item name="receiverName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="paymentMethod" label="Thanh toán (giả lập)">
                <Radio.Group className="flex flex-col gap-1">
                  <Radio value="COD">Tiền mặt khi nhận</Radio>
                  <Radio value="BANK_TRANSFER">Chuyển khoản</Radio>
                  <Radio value="E_WALLET">Ví điện tử</Radio>
                </Radio.Group>
              </Form.Item>

              <div className="mb-4 flex items-center justify-between border-t border-stone-100 pt-4">
                <span className="text-sm text-stone-500">Tổng cộng</span>
                <span className="text-lg font-bold tabular-nums text-amber-700">{formatVND(total())}</span>
              </div>

              <Button type="primary" htmlType="submit" size="large" block loading={submitting} disabled={submitting}>
                Đặt món · {formatVND(total())}
              </Button>
            </Form>
          </div>
        </aside>
      </div>
    </div>
  )
}