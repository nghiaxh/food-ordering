import { useState } from 'react'
import { Button, Checkbox, Form, Input, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { login, register } from '../api/api'
import { useAuthStore } from '../store/authStore'
import UiIcon from '../components/UiIcon'

function BackToHome() {
  return (
    <Link
      to="/"
      className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-500 transition hover:text-amber-400"
    >
      <UiIcon name="arrow-left" size={14} />
      Trang chủ
    </Link>
  )
}

const DEMO_ACCOUNTS = [
  { label: 'admin@demo.com', value: 'admin123' },
  { label: 'user@demo.com', value: 'user123' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)

  const onFinish = async (v: { email: string; password: string }) => {
    try {
      setLoading(true)
      const data = await login(v.email, v.password)
      setUser(data, remember)
      const isAdmin = data.role === 'ADMIN'
      message.success('Đăng nhập thành công!')
      navigate(isAdmin ? '/admin' : '/', { replace: true })
    } catch {
      message.error('Email hoặc mật khẩu không đúng')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-950 px-4">
      <BackToHome />
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:flex">
        <div className="relative hidden md:block md:w-1/2">
          <img src="/images/hero.jpg" alt="FoodOrdering" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent" />
          <div className="absolute inset-x-8 bottom-8 text-white">
            <h2 className="text-3xl font-extrabold text-balance">Chào mừng quay lại!</h2>
            <p className="mt-2 text-amber-200">Đặt món ngon trong vài phút, nhận hàng ngay trong 45 phút.</p>
          </div>
        </div>

        <div className="p-8 md:w-1/2 md:p-12">
          <div className="mb-8 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-xl text-white">
              <UiIcon name="user" />
            </span>
            <div>
              <div className="text-lg font-bold text-stone-900">Đăng nhập</div>
              <div className="text-xs text-stone-400">FoodOrdering</div>
            </div>
          </div>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }]}>
              <Input size="large" placeholder="ban@example.com" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password size="large" placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Form.Item className="mb-3">
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                <span className="text-sm text-stone-600">Ghi nhớ đăng nhập</span>
              </Checkbox>
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" block loading={loading}>
              Đăng nhập
            </Button>
          </Form>

          <div className="mt-5 text-center text-sm text-stone-500">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-semibold text-amber-700 hover:underline">
              Đăng ký ngay
            </Link>
          </div>

          <div className="mt-6 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
            <p className="text-center text-xs text-stone-400">Tài khoản thử:</p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <span key={a.label} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] text-stone-500 ring-1 ring-stone-200">
                  {a.label} / {a.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (v: {
    email: string
    password: string
    fullName: string
    phone: string
    address: string
  }) => {
    try {
      setLoading(true)
      await register(v)
      message.success('Đăng ký thành công! Vui lòng đăng nhập.')
      navigate('/login')
    } catch {
      message.error('Đăng ký không thành công. Có thể email đã tồn tại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-950 px-4 py-10">
      <BackToHome />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl md:p-10">
        <div className="mb-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-2xl text-white">
            <UiIcon name="user-add" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Tạo tài khoản mới</h1>
          <p className="mt-1 text-sm text-stone-500">Miễn phí · Đặt món nhanh hơn · Theo dõi đơn hàng</p>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input size="large" placeholder="Nguyễn Văn A" autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input size="large" placeholder="ban@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input size="large" placeholder="0968.xxx.xxx" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input size="large" placeholder="Quận 1, TP. HCM" autoComplete="street-address" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            hasFeedback
            rules={[
              { required: true, message: 'Nhập mật khẩu' },
              { min: 6, message: 'Tối thiểu 6 ký tự' },
            ]}
          >
            <Input.Password size="large" placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Nhập lại mật khẩu"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Nhập lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu không khớp'))
                },
              }),
            ]}
          >
            <Input.Password size="large" placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={loading}>
            Đăng ký
          </Button>
        </Form>

        <p className="mt-5 text-center text-sm text-stone-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-amber-700 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}