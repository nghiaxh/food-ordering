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
      <PageHeader title="Đơn hàng" subtitle={`Theo dõi ${stats.total} đơn đặt trong hệ thống.`} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng đơn" value={stats.total} />
        <StatCard label="Đang xử lý" value={stats.processing} />
        <StatCard label="Hoàn thành" value={stats.completed} />
        <StatCard label="Doanh thu" value={formatVND(stats.revenue)} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          style={{ width: 200 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Tất cả trạng thái', value: 'ALL' },
            ...ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s })),
          ]}
        />
      </PageCard>

      <Drawer
        title={detail ? `Đơn #${detail.id}` : 'Chi tiết đơn'}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        size={480}
      >
        {detail ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <StatusDot
                color={STATUS_HEX[detail.status]}
                label={ORDER_STATUS_LABEL[detail.status] ?? detail.status}
              />
              <Select
                size="small"
                value={detail.status}
                loading={busyIds.has(detail.id)}
                disabled={busyIds.has(detail.id)}
                onChange={(s) => changeStatus(detail.id, s)}
                style={{ width: 150 }}
                options={ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Thông tin đơn</p>
              <div className="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
                <p>
                  Đặt lúc:{' '}
                  <b className="font-medium text-stone-800">
                    {new Date(detail.createdAt).toLocaleString('vi-VN')}
                  </b>
                </p>
                <p>
                  Thanh toán: <b className="font-medium text-stone-800">{detail.paymentMethod}</b>
                </p>
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-sm text-stone-600">
                    Trạng thái:{' '}
                    <b className="font-medium text-stone-800">
                      {detail.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </b>
                  </span>
                  {detail.paymentStatus === 'PAID' ? (
                    <Button
                      size="small"
                      loading={busyIds.has(detail.id)}
                      disabled={busyIds.has(detail.id)}
                      onClick={() => changePayment(detail.id, false)}
                    >
                      Hoàn tác
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      loading={busyIds.has(detail.id)}
                      disabled={busyIds.has(detail.id)}
                      onClick={() => changePayment(detail.id, true)}
                    >
                      Đã thanh toán
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Người nhận</p>
              <div className="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
                <p>
                  <b className="font-medium text-stone-800">{detail.receiverName}</b>
                </p>
                <p className="tabular-nums">{detail.phone}</p>
                <p>{detail.address}</p>
                {detail.user?.email ? <p className="text-stone-400">{detail.user.email}</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Món đặt ({detail.items.length})
              </p>
              <div className="space-y-2.5">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-2.5">
                    <UiImg src={item.food.imageUrl} alt={item.food.name} className="h-12 w-12 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{item.food.name}</p>
                      <p className="text-xs text-stone-400">
                        {formatVND(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <b className="text-sm tabular-nums text-stone-800">{formatVND(item.price * item.quantity)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-sm text-stone-500">Tổng cộng</span>
              <b className="text-lg tabular-nums text-stone-900">{formatVND(detail.total)}</b>
            </div>
          </div>
        ) : (
          <EmptyState icon="inbox" title="Không tìm thấy đơn hàng." hint="Đơn có thể đã bị thay đổi." />
        )}
      </Drawer>
    </div>
  )
}