import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Popconfirm, Select, Table, message } from 'antd'
import { adminGetUsers, adminSetUserActive } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { User } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { EmptyState, PageCard, PageHeader, StatCard, StatusDot, TableSkeleton } from './shared'

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
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'CUSTOMER' | 'ADMIN'>('CUSTOMER')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (error) message.error('Không tải được danh sách khách hàng')
  }, [error])

  const stats = useMemo(() => {
    const list = (users ?? []).filter((u) => u.role === 'CUSTOMER')
    const active = list.filter((u) => u.active).length
    return { total: list.length, active, locked: list.length - active }
  }, [users])

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
      <PageHeader title="Khách hàng" subtitle="Quản lý tài khoản khách hàng của FoodOrdering." />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Tổng khách" value={stats.total} />
        <StatCard label="Đang hoạt động" value={stats.active} />
        <StatCard label="Bị khóa" value={stats.locked} />
      </div>

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
          style={{ width: 170 }}
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { label: 'Khách hàng', value: 'CUSTOMER' },
            { label: 'Quản trị viên', value: 'ADMIN' },
          ]}
        />
        <Select
          style={{ width: 170 }}
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
            scroll={{ x: 800 }}
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
                render: (_, u) => <span className="tabular-nums">#{u.id}</span>,
              },
              {
                title: 'Họ tên',
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
        )}
      </PageCard>
    </div>
  )
}