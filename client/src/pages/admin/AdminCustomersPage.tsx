import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Select, Table, Tooltip, message } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { adminDeleteUser, adminGetUsers, adminSaveUser, adminSetUserActive, type UserPayload } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import useBusySet from '../../hooks/useBusySet'
import type { User } from '../../types'
import { PHONE_RULE } from '../../utils/validators'
import UiIcon from '../../components/UiIcon'
import FormModal from '../../components/FormModal'
import { EmptyState, PageCard, PageHeader, StatusDot, TableSkeleton, confirmRemove, runAndMessage } from './shared'
import UiButton from '../../components/UiButton'

function initialOf(u: User): string {
  const source = u.fullName?.trim() || u.email?.trim() || '?'
  return source.charAt(0).toUpperCase()
}

export default function AdminCustomersPage() {
  const { data: users, loading, error, refresh: refreshUsers } = useAsyncData(
    () => adminGetUsers(),
    [],
  )
  const { run: toggleActive } = useAsyncAction(
    (payload: { id: number; active: boolean }) => adminSetUserActive(payload.id, payload.active),
  )
  const { run: saveUser, pending: saving } = useAsyncAction(
    (payload: { id: number | null; data: UserPayload }) => adminSaveUser(payload.id, payload.data),
  )
  const { run: deleteUser } = useAsyncAction((id: number) => adminDeleteUser(id))
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'CUSTOMER' | 'ADMIN'>('CUSTOMER')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')
  const { busyIds, mark } = useBusySet()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    if (error) message.error('Không tải được danh sách khách hàng')
  }, [error])

  const rows = useMemo(() => {
    const list = users ?? []
    const kw = search.trim().toLowerCase()
    return list.filter((u) => {
      if (u.role !== roleFilter) return false
      if (
        kw &&
        !u.fullName?.toLowerCase().includes(kw) &&
        !u.email?.toLowerCase().includes(kw) &&
        !(u.phone ?? '').includes(kw)
      ) {
        return false
      }
      if (statusFilter === 'active' && !u.active) return false
      if (statusFilter === 'locked' && u.active) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  const markBusy = mark

  const toggle = async (u: User) => {
    markBusy(u.id, true)
    const res = await toggleActive({ id: u.id, active: !u.active })
    markBusy(u.id, false)
    await runAndMessage(res, {
      success: 'Đã thay đổi trạng thái',
      fallback: 'Cập nhật thất bại',
      onSuccess: () => void refreshUsers(),
    })
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModal(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    form.setFieldsValue({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      address: u.address,
    })
    setModal(true)
  }

  const submit = async (v: UserPayload) => {
    const res = await saveUser({
      id: editing?.id ?? null,
      data: {
        email: v.email.trim(),
        fullName: v.fullName.trim(),
        phone: v.phone?.trim() ?? '',
        address: v.address?.trim() ?? '',
        // Để trống khi sửa nghĩa là giữ mật khẩu cũ, không gửi lên.
        password: v.password?.trim() || undefined,
      },
    })
    await runAndMessage(res, {
      success: editing ? 'Đã cập nhật khách hàng' : 'Đã tạo khách hàng',
      fallback: 'Lưu thất bại',
      onSuccess: () => {
        setModal(false)
        setEditing(null)
        void refreshUsers()
      },
    })
  }

  const remove = async (u: User) => {
    markBusy(u.id, true)
    const res = await deleteUser(u.id)
    markBusy(u.id, false)
    await runAndMessage(res, {
      success: 'Đã xóa khách hàng',
      fallback: 'Xóa thất bại',
      onSuccess: () => void refreshUsers(),
    })
  }

  return (
    <div>
      <PageHeader
        title="Khách hàng"
        extra={
          <UiButton kind="primary" onClick={openCreate}>
            Thêm khách hàng
          </UiButton>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, email hoặc số điện thoại..."
          allowClear
          prefix={<UiIcon name="search" size={16} />}
          className="w-full sm:w-80"
        />
        <Select
          className="min-w-0 flex-1 sm:flex-none sm:w-44"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { label: 'Khách hàng', value: 'CUSTOMER' },
            { label: 'Quản trị viên', value: 'ADMIN' },
          ]}
        />
        <Select
          className="min-w-0 flex-1 sm:flex-none sm:w-48"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Tất cả trạng thái', value: 'all' },
            { label: 'Hoạt động', value: 'active' },
            { label: 'Bị khóa', value: 'locked' },
          ]}
        />
      </div>

      <PageCard>
        {loading && !users ? (
          <TableSkeleton />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{
              emptyText: (
                <EmptyState
                  icon="users"
                  title="Không tìm thấy tài khoản."
                  hint="Điều chỉnh bộ lọc hoặc từ khóa tìm kiếm."
                />
              ),
            }}
            columns={[
              {
                title: 'ID',
                width: 70,
                fixed: 'left',
                render: (_, u) => <span className="tabular-nums">#{u.id}</span>,
              },
              {
                title: 'Họ tên',
                fixed: 'left',
                render: (_, u) => (
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-500">
                      {initialOf(u)}
                    </span>
                    <span className="font-medium text-stone-700">{u.fullName || '—'}</span>
                  </div>
                ),
              },
              { title: 'Email', render: (_, u) => <span className="text-stone-500">{u.email}</span> },
              {
                title: 'SĐT',
                width: 140,
                render: (_, u) => <span className="tabular-nums text-stone-600">{u.phone || '—'}</span>,
              },
              {
                title: 'Vai trò',
                width: 120,
                render: (_, u) => (
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {u.role === 'ADMIN' ? 'Quản trị' : 'Khách hàng'}
                  </span>
                ),
              },
              {
                title: 'Trạng thái',
                width: 140,
                render: (_, u) =>
                  u.active ? (
                    <StatusDot color="#10b981" label="Hoạt động" />
                  ) : (
                    <StatusDot color="#a8a29e" label="Đã khóa" muted />
                  ),
              },
              {
                title: 'Thao tác',
                width: 250,
                render: (_, u) => (
                  <div className="flex items-center gap-2">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)}>
                      Sửa
                    </Button>
                    {/* Tài khoản quản trị không được khoá hay xoá, nên ẩn luôn hai nút này. */}
                    {u.role === 'CUSTOMER' ? (
                      <>
                        <Button
                          size="small"
                          loading={busyIds.has(u.id)}
                          danger={u.active}
                          onClick={() =>
                            Modal.confirm({
                              title: `${u.active ? 'Khóa' : 'Kích hoạt'} ${u.fullName}?`,
                              centered: true,
                              okText: u.active ? 'Khóa' : 'Kích hoạt',
                              okButtonProps: u.active ? { danger: true } : undefined,
                              cancelText: 'Hủy',
                              onOk: () => toggle(u),
                            })
                          }
                        >
                          {u.active ? 'Khóa' : 'Kích hoạt'}
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={busyIds.has(u.id)}
                          onClick={() =>
                            confirmRemove({
                              title: 'Xóa khách hàng này?',
                              content: 'Giỏ hàng bị xoá kèm. Đơn hàng đã đặt vẫn được giữ lại.',
                              onOk: () => remove(u),
                            })
                          }
                        />
                      </>
                    ) : (
                      <Tooltip title="Không thể khóa hoặc xóa tài khoản quản trị">
                        <span className="text-xs text-stone-400">Tài khoản hệ thống</span>
                      </Tooltip>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </PageCard>

      <FormModal
        title={editing ? `Sửa: ${editing.fullName}` : 'Thêm khách hàng'}
        open={modal}
        onClose={() => setModal(false)}
        onSubmit={() => form.submit()}
        saving={saving}
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="ban@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[PHONE_RULE]}>
            <Input placeholder="0900000000" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'Mật khẩu mới' : 'Mật khẩu'}
            rules={
              editing
                ? [{ min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' }]
                : [
                    { required: true, message: 'Nhập mật khẩu' },
                    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
                  ]
            }
            extra={editing ? 'Để trống nếu không muốn đổi mật khẩu.' : undefined}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </FormModal>
    </div>
  )
}