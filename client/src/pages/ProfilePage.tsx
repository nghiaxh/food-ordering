import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Skeleton, message } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { changePassword, getMe, updateMe } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'

const PHONE_RULE = { pattern: /^0\d{9}$/, message: 'Số điện thoại phải gồm đúng 10 chữ số' }

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [changing, setChanging] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)

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

  const submitPassword = async (v: { currentPassword: string; newPassword: string; confirm: string }) => {
    try {
      setChanging(true)
      await changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      message.success('Đổi mật khẩu thành công!')
      passwordForm.resetFields()
      setPasswordModal(false)
    } catch {
      message.error('Không đổi được mật khẩu. Kiểm tra lại mật khẩu hiện tại.')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="profile-page mx-auto max-w-2xl px-4 py-10">
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200/60">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
          <UserOutlined />
        </span>
        <div className="mt-3">
          <div className="text-lg font-semibold text-stone-900">{user?.fullName}</div>
          <div className="text-sm text-stone-500">{user?.email}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-stone-400">
            {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
        <h2 className="text-base font-semibold text-stone-900">Thông tin cá nhân</h2>
        <Form form={form} layout="vertical" className="mt-4" onFinish={submit}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[PHONE_RULE]}>
            <Input placeholder="0900000000" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
          <div className="mt-4 flex items-center gap-2">
            <Button type="primary" htmlType="submit" loading={saving}>
              Lưu thay đổi
            </Button>
            <Button onClick={() => setPasswordModal(true)}>Đổi mật khẩu</Button>
          </div>
        </Form>
      </div>

      <Modal
        title="Đổi mật khẩu"
        open={passwordModal}
        onCancel={() => {
          passwordForm.resetFields()
          setPasswordModal(false)
        }}
        onOk={() => passwordForm.submit()}
        confirmLoading={changing}
        okText="Đổi mật khẩu"
        cancelText="Hủy"
      >
        <p className="mb-4 text-sm text-stone-500">
          Mật khẩu gồm 8 ký tự trở lên. Email không thay đổi được, liên hệ quản trị viên nếu cần.
        </p>
        <Form form={passwordForm} layout="vertical" onFinish={submitPassword}>
          <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Nhập lại mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu không khớp'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}