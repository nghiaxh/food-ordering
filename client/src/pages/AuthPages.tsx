import { useState } from 'react'
import { Button, Form, Input, message } from 'antd'
import { GoogleOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { login, register } from '../api/api'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const onFinish = async (v: { email: string; password: string }) => {
    try {
      setLoading(true)
      const data = await login(v.email, v.password)
      setUser(data)
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
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:flex">
        <div className="relative hidden md:block md:w-1/2">
          <img src="/images/hero.jpg" alt="FoodOrdering" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent" />
          <div className="absolute bottom-8 left-8 text-white">
            <h2 className="text-3xl font-extrabold">Chào mừng quay lại!</h2>
            <p className="mt-2 text-amber-200">Đặt món ngon trong vài phút, nhận hàng ngay trong 45 phút.</p>
          </div>
        </div>

        <div className="p-8 md:w-1/2 md:p-12">
          <div className="mb-8 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-xl text-white">
              <UserOutlined />
            </span>
            <div>
              <div className="text-lg font-bold text-stone-900">Đăng nhập</div>
              <div className="text-xs text-stone-400">FoodOrdering</div>
            </div>
          </div>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }]}>
              <Input size="large" placeholder="ban@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password size="large" placeholder="••••••••" />
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

          <div className="my-6 flex items-center gap-3 text-xs text-stone-300">
            <span className="h-px flex-1 bg-stone-200" />
            HOẶC
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <Button block size="large" icon={<GoogleOutlined />}>
            Đăng nhập bằng Google
          </Button>
          <p className="mt-3 text-center text-xs text-stone-400">
            Đăng nhập thử: <b>admin@demo.com / admin123</b> hoặc <b>user@demo.com / user123</b>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute left-4 top-4 flex flex-col gap-1.5 text-amber-500"
        aria-label="Quay lại trang chủ"
      >
        <span className="ml-4 text-sm font-semibold">&larr; Trang chủ</span>
      </button>
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
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl md:p-10">
        <div className="mb-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-2xl text-white">
            <UserAddOutlined />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Tạo tài khoản mới</h1>
          <p className="mt-1 text-sm text-stone-500">Miễn phí · Đặt món nhanh hơn · Theo dõi đơn hàng</p>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input size="large" placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input size="large" placeholder="ban@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input size="large" placeholder="0968.xxx.xxx" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input size="large" placeholder="Quận 1, TP. HCM" />
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
            <Input.Password size="large" placeholder="••••••••" />
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
            <Input.Password size="large" placeholder="••••••••" />
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