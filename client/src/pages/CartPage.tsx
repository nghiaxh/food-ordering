import { useEffect, useState } from 'react'
import { Button, Empty, Form, Input, Modal, Radio, Skeleton, message } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import UiImg from '../components/UiImg'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255
const REDIRECT_SECONDS = 3

export default function CartPage() {
  const { items, loaded, setQuantity, remove, clear, count, total } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [successOpen, setSuccessOpen] = useState(false)
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)

  const { run: submitOrder, pending: submitting } = useAsyncAction(
    (payload: {
      items: { foodId: number; quantity: number }[]
      receiverName: string
      phone: string
      address: string
      paymentMethod: string
      note?: string
    }) => createOrder(payload),
  )

  // Người dùng giảm chuyển động thì không tự đóng modal, chỉ dùng nút bấm tay.
  const autoRedirect =
    typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!successOpen || !autoRedirect) return
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [successOpen, autoRedirect, countdown])

  useEffect(() => {
    if (successOpen && countdown <= 0) goToFoods()
  }, [successOpen, countdown])

  function goToFoods() {
    setSuccessOpen(false)
    navigate('/foods')
  }

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
    if (submitting) return
    const res = await submitOrder({
      ...v,
      items: items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    })
    if (res.ok) {
      await clear()
      setCountdown(REDIRECT_SECONDS)
      setSuccessOpen(true)
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

  // Modal phải nằm ngoài mọi nhánh return sớm: đặt xong giỏ bị xóa ngay nên component
  // rơi vào nhánh "giỏ trống", đặt modal bên trong nhánh đó là modal không bao giờ hiện.
  const successModal = (
    <Modal open={successOpen} footer={null} closable={false} mask={{ closable: false }} keyboard={false} centered>
      <div className="py-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircleOutlined style={{ fontSize: 30 }} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-stone-900">Đặt món thành công</h2>
        <p className="mt-1 text-sm text-stone-500">Quán sẽ sớm xác nhận yêu cầu của bạn.</p>
        <Button type="primary" size="large" block className="mt-6" onClick={goToFoods}>
          Về trang Thực đơn{autoRedirect ? ` (${countdown}s)` : ''}
        </Button>
      </div>
    </Modal>
  )

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton active />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Empty description="Giỏ hàng của bạn đang trống">
            <Link to="/foods">
              <Button type="primary">Khám phá thực đơn</Button>
            </Link>
          </Empty>
        </div>
        {successModal}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-32">
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
              className="border-b border-stone-100 px-5 py-4 last:border-b-0 sm:flex sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
                <Link to={`/foods/${i.food.id}`} className="shrink-0">
                  <UiImg
                    src={i.food.imageUrl}
                    alt={i.food.name}
                    className="h-20 w-20 rounded-xl"
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
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:shrink-0 sm:justify-end">
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
                  className="!h-10 !w-10"
                  onClick={() => remove(i.food.id)}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-5 py-4">
            <span className="text-sm text-stone-500">Tạm tính</span>
            <span className="text-lg font-bold tabular-nums text-amber-700">{formatVND(total())}</span>
          </div>
        </div>

        {/* Checkout: nút gửi nằm ở thanh cố định đáy, form chỉ chứa dữ liệu */}
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
              <Form.Item
                name="note"
                label="Lưu ý cho quán"
                extra="Ví dụ: ít cay, không hành, gọi trước 10 phút"
                rules={[{ max: NOTE_MAX_LENGTH, message: `Lưu ý không được vượt quá ${NOTE_MAX_LENGTH} ký tự` }]}
              >
                <Input.TextArea rows={3} showCount maxLength={NOTE_MAX_LENGTH} placeholder="Ghi chú thêm cho quán" />
              </Form.Item>
            </Form>
          </div>
        </aside>
      </div>

      {/* Thanh cố định đáy: tổng tiền và nút gửi duy nhất của trang */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm text-stone-600">
            <b className="font-semibold text-stone-900">Tổng cộng</b>
            <span className="ml-2 font-bold tabular-nums text-amber-700">{formatVND(total())}</span>
          </p>
          <Button
            type="primary"
            htmlType="submit"
            form={CHECKOUT_FORM_ID}
            size="large"
            loading={submitting}
            disabled={submitting}
          >
            Xác nhận đặt món
          </Button>
        </div>
      </div>

      {successModal}
    </div>
  )
}
