import { useEffect, useState } from 'react'
import { message } from 'antd'
import { Link } from 'react-router-dom'
import {
  adminGetOrders,
  adminGetReportSummary,
  adminGetReportTopFoods,
  adminUpdateOrderStatus,
} from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import type { Order } from '../../types'
import { orderCode } from '../../utils/orders'
import { formatVND, formatRelativeTime } from '../../utils/format'
import UiButton from '../../components/UiButton'
import { PageCard, PageHeader } from './shared'

/**
 * Tổng quan dành cho quản trị: chỉ số chính, đơn đang chờ và món bán chạy. Trang này cố ý
 * không dùng thẻ nhiều màu hay biểu đồ cầu kỳ; việc cần làm (duyệt đơn) nằm ngay trên đầu.
 */
export default function AdminDashboardPage() {
  const { data: summary, refresh: refreshSummary } = useAsyncData(() => adminGetReportSummary(), [])
  const { data: orders, refresh: refreshOrders } = useAsyncData(() => adminGetOrders(), [])
  const { data: topFoods } = useAsyncData(() => adminGetReportTopFoods(undefined, undefined, 5), [])
  const [approving, setApproving] = useState<number | null>(null)

  useEffect(() => {
    document.title = 'Tổng quan · Quản trị'
  }, [])

  const pending = (orders ?? []).filter((o) => o.status === 'PENDING').slice(0, 6)
  const maxTop = Math.max(1, ...(topFoods ?? []).map((f) => f.quantity))

  const approve = async (order: Order) => {
    setApproving(order.id)
    try {
      await adminUpdateOrderStatus(order.id, 'CONFIRMED')
      message.success(`Đã xác nhận đơn ${orderCode(order.id)}`)
      refreshOrders()
      refreshSummary()
    } catch {
      message.error('Không xác nhận được đơn này')
    } finally {
      setApproving(null)
    }
  }

  const metrics = [
    { label: 'Doanh thu 30 ngày', value: formatVND(summary?.revenue ?? 0) },
    { label: 'Đơn hàng', value: `${summary?.orderCount ?? 0}` },
    { label: 'Giá trị đơn trung bình', value: formatVND(summary?.avgOrder ?? 0) },
    { label: 'Khách đã đặt', value: `${summary?.customerCount ?? 0}` },
  ]

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        subtitle="Số liệu 30 ngày gần nhất, cập nhật theo từng đơn."
        extra={
          <Link to="/admin/reports">
            <UiButton kind="default">Xem báo cáo</UiButton>
          </Link>
        }
      />

      <div className="grid grid-cols-2 divide-stone-200 rounded-xl border border-stone-200 bg-white sm:grid-cols-4 sm:divide-x">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`px-5 py-4 ${i < 2 ? 'border-b border-stone-200 sm:border-b-0' : ''} ${
              i % 2 === 1 ? 'border-l border-stone-200 sm:border-l-0' : ''
            }`}
          >
            <div className="text-xs text-stone-500">{m.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PageCard>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
            <div>
              <h3 className="font-semibold text-stone-800">Đơn chờ xác nhận</h3>
              <p className="mt-0.5 text-xs text-stone-500">
                {pending.length === 0 ? 'Không còn đơn nào đang chờ.' : `${pending.length} đơn cần xử lý`}
              </p>
            </div>
            <Link to="/admin/orders" className="text-sm font-medium text-amber-700 hover:underline">
              Tất cả đơn
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-400">Hộp đơn đang trống.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {pending.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{orderCode(o.id)}</span>
                      <span className="text-xs text-stone-400">{formatRelativeTime(o.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500">
                      {o.receiverName} · {o.items.length} món · {formatVND(o.total)}
                    </div>
                  </div>
                  <UiButton
                    kind="primary"
                    size="small"
                    loading={approving === o.id}
                    onClick={() => void approve(o)}
                  >
                    Xác nhận
                  </UiButton>
                </li>
              ))}
            </ul>
          )}
        </PageCard>

        <PageCard>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
            <div>
              <h3 className="font-semibold text-stone-800">Món bán chạy</h3>
              <p className="mt-0.5 text-xs text-stone-500">Theo số phần đã bán trong 30 ngày.</p>
            </div>
            <Link to="/admin/reports" className="text-sm font-medium text-amber-700 hover:underline">
              Chi tiết
            </Link>
          </div>
          {(topFoods?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-400">Chưa có dữ liệu bán hàng.</p>
          ) : (
            <ul className="space-y-3 px-5 py-4">
              {(topFoods ?? []).map((f) => (
                <li key={f.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{f.name}</span>
                    <span className="shrink-0 tabular-nums text-stone-500">{f.quantity} phần</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-amber-600"
                      style={{ width: `${Math.max(4, Math.round((f.quantity / maxTop) * 100))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { to: '/admin/foods', label: 'Quản lý món ăn', hint: 'Giá, ảnh, trạng thái phục vụ' },
          { to: '/admin/promotions', label: 'Chương trình khuyến mãi', hint: 'Voucher, giảm giá theo dịp' },
          { to: '/admin/chatbot', label: 'Cấu hình chatbot', hint: 'Nhà cung cấp AI và mô hình' },
        ].map((shortcut) => (
          <Link
            key={shortcut.to}
            to={shortcut.to}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-amber-400"
          >
            <div className="text-sm font-medium text-stone-800">{shortcut.label}</div>
            <div className="mt-0.5 text-xs text-stone-500">{shortcut.hint}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
