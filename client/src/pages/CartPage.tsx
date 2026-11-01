import { useState } from 'react'
import { Empty, Form, Input, Radio, Skeleton, message } from 'antd'
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import UiButton from '../components/UiButton'
import UiImg from '../components/UiImg'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255

export default function CartPage() {
  const { items, setQuantity, remove, clear, total } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [ordering, setOrdering] = useState(false)

  const { run: submitOrder, pending: submitting } = useAsyncAction(
    (payload: {
      items: { foodId: number; quantity: number }[]
      receiverName: string
      phone: string
      address: string
      paymentMethod: string
    }) => createOrder(payload),
  )

  const submit = async (v: {
    receiverName: string
    phone: string
    address: string
    paymentMethod: string
    note?: string
  }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đặt món')
      navigate('/login')
      return
    }
    if (submitting || ordering) return
    setOrdering(true)
    const res = await submitOrder({
      ...v,
      items: items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    })
    setOrdering(false)
    if (res.ok) {
      await clear()
      // Đặt xong thẳng sang trang đơn hàng để khách theo dõi được ngay, không qua màn hình chờ.
      message.success('Đặt món thành công')
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
          <Link to="/">
            <UiButton kind="primary">Khám phá thực đơn</UiButton>
          </Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-stone-900">Giỏ hàng &amp; Đặt món</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Danh sách dòng món: đổi số lượng, xoá món và tổng tiền */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
          <div className="border-b border-stone-100 px-5 py-3 text-sm font-medium text-stone-500">
            {count()} món trong giỏ
          </div>
          {items.map((i) => (
            <div
              key={i.food.id}
              className="border-b border-stone-100 px-5 py-4 last:border-b-0 sm:flex sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
                <Link to={`/foods/${i.food.id}`} className="shrink-0">
                  <UiImg src={i.food.imageUrl} alt={i.food.name} className="h-20 w-20 rounded-xl" />
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
                    <div className="mt-1 text-xs font-medium text-red-600">Hết món</div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:shrink-0 sm:justify-end">
                <div className="flex items-center rounded-full ring-1 ring-stone-200">
                  <button
                    type="button"
                    aria-label="Giảm số lượng"
                    disabled={i.quantity <= 1}
                    onClick={() => setQuantity(i.food.id, i.quantity - 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-l-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MinusOutlined style={{ fontSize: 12 }} />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                  <button
                    type="button"
                    aria-label="Tăng số lượng"
                    onClick={() => setQuantity(i.food.id, i.quantity + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-r-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                  >
                    <PlusOutlined style={{ fontSize: 12 }} />
                  </button>
                </div>

                <div className="w-24 text-right font-semibold tabular-nums text-stone-900">
                  {formatVND(i.food.price * i.quantity)}
                </div>

                <UiButton
                  kind="icon"
                  danger
                  aria-label="Xóa món"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(i.food.id)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Biểu mẫu đặt món; nút gửi nằm ở thanh cố định đáy để chỉ có một CTA */}
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-96">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <h2 className="text-lg font-bold text-stone-900">Thông tin giao hàng</h2>
            <Form
              id={CHECKOUT_FORM_ID}
              layout="vertical"
              onFinish={submit}
              className="mt-4"
              initialValues={{ receiverName: user?.fullName, paymentMethod: 'COD' }}
            >
              <Form.Item name="receiverName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: 'Nhập số điện thoại' },
                  { pattern: /^0\d{9}$/, message: 'Số điện thoại phải gồm đúng 10 chữ số' },
                ]}
              >
                <Input placeholder="0900000000" />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ nhận món" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}>
                <Input />
              </Form.Item>
              {/* Nhóm nút chọn phương thức thanh toán, luôn hiển thị theo Bảng 2.22 */}
              <Form.Item name="paymentMethod" label="Phương thức thanh toán (giả lập)">
                <Radio.Group className="flex flex-col gap-1">
                  <Radio value="COD">Tiền mặt khi nhận</Radio>
                  <Radio value="BANK_TRANSFER">Chuyển khoản</Radio>
                  <Radio value="E_WALLET">Ví điện tử</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="note"
                label="Lưu ý cho quán"
                extra="Ví dụ: ít cay, không hành, gọi trước 10 phút"
                rules={[{ max: NOTE_MAX_LENGTH, message: `Lưu ý không được vượt quá ${NOTE_MAX_LENGTH} ký tự` }]}
              >
                <Input.TextArea rows={3} showCount maxLength={NOTE_MAX_LENGTH} placeholder="Ghi chú thêm cho quán" />
              </Form.Item>
              <p className="-mt-2 text-xs leading-relaxed text-stone-400">
                Gọi hotline 0246.888.9999 hoặc email hello@foodordering.vn nếu cần hỗ trợ đơn.
              </p>
            </Form>
          </div>
        </aside>
      </div>

      {/* Thanh cố định đáy: tổng tiền và nút xác nhận duy nhất của trang */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm text-stone-600">
            <b className="font-semibold text-stone-900">Tổng cộng</b>
            <span className="ml-2 font-bold tabular-nums text-amber-700">{formatVND(total())}</span>
          </p>
          <UiButton
            kind="primary-lg"
            htmlType="submit"
            form={CHECKOUT_FORM_ID}
            loading={submitting || ordering}
            disabled={submitting || ordering}
          >
            Xác nhận đặt món
          </UiButton>
        </div>
      </div>
    </div>
  )
}