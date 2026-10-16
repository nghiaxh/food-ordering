import { useEffect, useState } from 'react'
import { Button, Empty, Form, Input, Modal, Radio, Skeleton, message } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'

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

      <div className="mt-6 space-y-10 lg:flex lg:gap-8">
        <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
          <Table
            rowKey={(r) => r.food.id}
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: 'Món',
                render: (_, r) => (
                  <div className="flex items-center gap-3">
                    <img src={r.food.imageUrl} alt={r.food.name} width={44} height={44} className="rounded-lg object-cover" />
                    <Link to={`/foods/${r.food.id}`} className="font-medium text-stone-800 hover:text-amber-700">
                      {r.food.name}
                    </Link>
                  </div>
                ),
              },
              { title: 'Đơn giá', width: 120, render: (_, r) => formatVND(r.food.price) },
              {
                title: 'Số lượng',
                width: 150,
                render: (_, r) => (
                  <InputNumber min={1} value={r.quantity} onChange={(v) => setQuantity(r.food.id, v ?? 1)} />
                ),
              },
              { title: 'Thành tiền', width: 130, render: (_, r) => <b>{formatVND(r.food.price * r.quantity)}</b> },
              {
                title: '',
                width: 60,
                render: (_, r) => (
                  <Button danger type="link" icon={<DeleteOutlined />} onClick={() => remove(r.food.id)} aria-label="Xóa" />
                ),
              },
            ]}
          />
          <div className="border-t border-stone-100 px-6 py-4 text-right">
            <div className="text-lg">
              Tổng cộng: <b className="text-amber-700">{formatVND(total())}</b>
            </div>
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
