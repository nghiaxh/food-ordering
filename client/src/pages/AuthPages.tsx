import { useState } from 'react'
import { Button, Checkbox, Form, Input, message } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login, register } from '../api/api'
import { useAuthStore } from '../store/authStore'
import AuthShell from '../components/AuthShell'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)

  const onFinish = async (v: { email: string; password: string }) => {
    try {
      setLoading(true)
      const data = await login(v.email, v.password)
      setUser(data, remember)
      const isAdmin = data.role === 'ADMIN'
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      const target = isAdmin ? '/admin' : from && from !== '/login' ? from : '/'
      message.success('Đăng nhập thành công!')
      navigate(target, { replace: true })
    } catch {
      message.error('Email hoặc mật khẩu không đúng')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Đăng nhập">
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="auth-form">
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }]}>
          <Input size="middle" placeholder="ban@example.com" autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
          <Input.Password size="middle" placeholder="••••••••" autoComplete="current-password" />
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

      <div className="mt-4 text-center text-sm text-stone-500">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-semibold text-amber-700 hover:underline">
          Đăng ký ngay
        </Link>
      </div>
    </AuthShell>
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
    <AuthShell title="Đăng ký" maxWidth="max-w-[440px]">
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="auth-form">
        <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input size="middle" placeholder="Nguyễn Văn A" autoComplete="name" />
        </Form.Item>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input size="middle" placeholder="ban@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input size="middle" placeholder="0968.xxx.xxx" autoComplete="tel" />
          </Form.Item>
        </div>
        <Form.Item name="address" label="Địa chỉ">
          <Input size="middle" placeholder="Quận 1, TP. HCM" autoComplete="street-address" />
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
          <Input.Password size="middle" placeholder="••••••••" autoComplete="new-password" />
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
          <Input.Password size="middle" placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Đăng ký
        </Button>
      </Form>

      <p className="mt-4 text-center text-sm text-stone-500">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-semibold text-amber-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  )
}
