import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Popconfirm, Table, Tag, message } from 'antd'
import { adminGetUsers, adminSetUserActive } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { User } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { PageCard } from './shared'

export default function AdminCustomersPage() {
  const { data: users, loading, error, refresh: refreshUsers } = useAsyncData(
    () => adminGetUsers(),
    [],
  )
  const { run: toggleActive } = useAsyncAction(
    (payload: { id: number; active: boolean }) => adminSetUserActive(payload.id, payload.active),
  )
  const [search, setSearch] = useState('')
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (error) message.error('Không tải được danh sách khách hàng')
  }, [error])

  const rows = useMemo(() => {
    const list = users ?? []
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(kw) ||
        u.email?.toLowerCase().includes(kw) ||
        (u.phone ?? '').includes(kw),
    )
  }, [users, search])

  const toggle = async (u: User) => {
    setBusyIds((prev) => new Set(prev).add(u.id))
    const res = await toggleActive({ id: u.id, active: !u.active })
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(u.id)
      return next
    })
    if (res.ok) {
      message.success('Đã thay đổi trạng thái')
      void refreshUsers()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Cập nhật thất bại')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, email hoặc số điện thoại..."
          allowClear
          prefix={<UiIcon name="search" size={16} />}
          className="!w-80"
        />
        <span className="text-sm text-stone-500">
          Tổng cộng <b>{rows.length}</b> tài khoản
        </span>
      </div>

      <PageCard>
        <Table
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 700 }}
          locale={{
            emptyText: (
              <div className="flex flex-col items-center py-10 text-stone-400">
                <UiIcon name="inbox" size={32} className="mb-2 text-stone-300" />
                <p className="text-sm">Không tìm thấy tài khoản nào.</p>
              </div>
            ),
          }}
          columns={[
            { title: 'ID', width: 70, render: (_, u) => `#${u.id}` },
            { title: 'Họ tên', render: (_, u) => <span className="font-medium text-stone-700">{u.fullName}</span> },
            { title: 'Email', render: (_, u) => <span className="text-stone-500">{u.email}</span> },
            {
              title: 'Vai trò',
              width: 120,
              render: (_, u) => <Tag color={u.role === 'ADMIN' ? 'purple' : 'blue'}>{u.role}</Tag>,
            },
            {
              title: 'Trạng thái',
              width: 140,
              render: (_, u) => (
                <Tag color={u.active ? 'green' : 'default'}>{u.active ? 'Hoạt động' : 'Đã khóa'}</Tag>
              ),
            },
            {
              title: 'Thao tác',
              width: 150,
              render: (_, u) => (
                <Popconfirm title={`${u.active ? 'Khóa' : 'Kích hoạt'} ${u.fullName}?`} onConfirm={() => toggle(u)}>
                  <Button size="small" loading={busyIds.has(u.id)} danger={u.active}>
                    {u.active ? 'Khóa' : 'Kích hoạt'}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </PageCard>
    </div>
  )
}