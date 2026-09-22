import { Button, Empty, Form, Input, InputNumber, Radio, Table, Typography, message } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'

export default function CartPage() {
  const { items, setQuantity, remove, clear, total } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const submit = async (v: { receiverName: string; phone: string; address: string; paymentMethod: string }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đặt món')
      navigate('/login')
      return
    }
    try {
      await createOrder({ ...v, items: items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })) })
      message.success('Đặt món thành công!')
      clear()
      navigate('/orders')
    } catch (e) {
      message.error(typeof e === 'object' && e !== null && 'response' in e
        ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Đặt món thất bại')
        : 'Đặt món thất bại')
    }
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">Giỏ hàng</h1>

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

        <div className="w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60 lg:w-96">
          <Typography.Title level={4}>Thông tin giao hàng</Typography.Title>
          <Form
            layout="vertical"
            onFinish={submit}
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
            <Button type="primary" htmlType="submit" size="large" block>
              Đặt món · {formatVND(total())}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}