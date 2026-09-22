import { useEffect, useState } from 'react'
import { Button, Form, Input, Skeleton, message } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { getMe, updateMe } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const { data: me, loading, error } = useAsyncData((signal) => getMe(signal), [])

  useEffect(() => {
    if (me) {
      form.setFieldsValue({ fullName: me.fullName, phone: me.phone, address: me.address })
    }
  }, [me, form])

  useEffect(() => {
    if (error) message.error('Không tải được hồ sơ')
  }, [error])

  if (loading) return <Skeleton active />

  const submit = async (v: { fullName: string; phone: string; address: string }) => {
    try {
      setSaving(true)
      await updateMe(v)
      message.success('Cập nhật hồ sơ thành công!')
    } catch {
      message.error('Cập nhật thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Tài khoản
      </div>
      <h1 className="text-3xl font-bold text-stone-900">Hồ sơ của tôi</h1>
      <p className="mt-2 text-stone-500">Cập nhật thông tin cá nhân để giao hàng nhanh hơn.</p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
          <UserOutlined />
        </span>
        <div>
          <div className="text-lg font-semibold text-stone-900">{user?.fullName}</div>
          <div className="text-sm text-stone-500">{user?.email}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-stone-400">{user?.role}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Lưu thay đổi</Button>
        </Form>
      </div>
    </div>
  )
}