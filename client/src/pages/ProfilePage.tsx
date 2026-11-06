import { useEffect, useState } from 'react'
import { Form, Input, Modal, Skeleton, message } from 'antd'
import { changePassword, getMe, updateMe } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useAuthStore } from '../store/authStore'
import UiButton from '../components/UiButton'

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

  const initial = user?.fullName.charAt(0).toUpperCase() ?? '?'
  const joined = me?.createdAt ? new Date(me.createdAt) : null
  const joinedLabel =
    joined && !Number.isNaN(joined.getTime())
      ? `Tham gia từ ${joined.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
      : null

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">      
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <section className="rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200/60">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-700 text-2xl font-bold text-white">
            {initial}
          </span>
          <p className="mt-3 text-base font-semibold text-stone-900">{user?.fullName}</p>
          <p className="mt-0.5 break-all text-sm text-stone-500">{user?.email}</p>
          <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
          </span>
          {joinedLabel && <p className="mt-2 text-xs text-stone-400">{joinedLabel}</p>}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900">Thông tin cá nhân</h2>
            <Form form={form} layout="vertical" className="mt-4" onFinish={submit}>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="Số điện thoại" rules={[PHONE_RULE]}>
                  <Input placeholder="0900000000" />
                </Form.Item>
              </div>
              <Form.Item name="address" label="Địa chỉ">
                <Input />
              </Form.Item>
              <div className="flex justify-end">
                <UiButton kind="primary" htmlType="submit" loading={saving}>
                  Lưu thay đổi
                </UiButton>
              </div>
            </Form>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Bảo mật</h2>
              <p className="mt-0.5 text-sm text-stone-500">Đổi mật khẩu đăng nhập của bạn.</p>
            </div>
            <UiButton kind="default" onClick={() => setPasswordModal(true)}>
              Đổi mật khẩu
            </UiButton>
          </section>
        </div>
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
