import { useEffect, useState } from 'react'
import { Select, Space, Table, Tag, message } from 'antd'
import { adminGetOrders, adminUpdateOrderStatus } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { OrderStatus } from '../../types'
import { formatVND } from '../../utils/format'
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../../utils/orders'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { PageCard } from './shared'

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED']

export default function AdminOrdersPage() {
  const { data: orders, loading, error, refresh: refreshOrders } = useAsyncData(
    () => adminGetOrders(),
    [],
  )
  const { run: updateStatus } = useAsyncAction(
    (payload: { id: number; status: OrderStatus }) => adminUpdateOrderStatus(payload.id, payload.status),
  )
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (error) message.error('Không tải được đơn hàng')
  }, [error])

  const changeStatus = async (id: number, status: OrderStatus) => {
    setBusyIds((prev) => new Set(prev).add(id))
    const res = await updateStatus({ id, status })
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (res.ok) {
      message.success('Đã cập nhật trạng thái')
      void refreshOrders()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Cập nhật thất bại')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageCard>
        <Table
          rowKey="id"
          dataSource={orders}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <div className="flex flex-col items-center py-10 text-stone-400">
                <UiIcon name="inbox" size={32} className="mb-2 text-stone-300" />
                <p className="text-sm">Chưa có đơn hàng nào.</p>
              </div>
            ),
          }}
          columns={[
            { title: 'Mã đơn', width: 90, render: (_, o) => `#${o.id}` },
            {
              title: 'Khách',
              width: 160,
              render: (_, o) => (
                <div className="flex flex-col text-stone-700">
                  <span className="font-medium">{o.receiverName}</span>
                  <span className="text-xs text-stone-400">{o.phone}</span>
                </div>
              ),
            },
            { title: 'Địa chỉ', render: (_, o) => <span className="text-stone-500">{o.address}</span> },
            { title: 'Món đặt', width: 100, render: (_, o) => <Tag>{o.items.length} món</Tag> },
            {
              title: 'Tổng tiền',
              width: 140,
              render: (_, o) => <b className="tabular-nums">{formatVND(o.total)}</b>,
            },
            {
              title: 'Trạng thái',
              width: 240,
              render: (_, o) => (
                <Space.Compact>
                  <Tag color={ORDER_STATUS_COLOR[o.status] ?? 'default'} className="!m-0">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </Tag>
                  <Select
                    size="small"
                    value={o.status}
                    loading={busyIds.has(o.id)}
                    disabled={busyIds.has(o.id)}
                    onChange={(s) => changeStatus(o.id, s)}
                    style={{ width: 140 }}
                    options={ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s }))}
                  />
                </Space.Compact>
              ),
            },
          ]}
        />
      </PageCard>
    </div>
  )
}