import { useState } from 'react'
import { DatePicker, Table, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import {
  adminExportReport,
  adminGetReportRevenue,
  adminGetReportSummary,
  adminGetReportTopFoods,
} from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import { formatVND } from '../../utils/format'
import UiButton from '../../components/UiButton'
import { PageCard, PageHeader } from './shared'

type Range = [Dayjs, Dayjs] | null

function rangeParams(range: Range): [string | undefined, string | undefined] {
  return [range?.[0].toISOString(), range?.[1].toISOString()]
}

export default function AdminReportsPage() {
  const [range, setRange] = useState<Range>(null)
  const [applied, setApplied] = useState<Range>(null)

  const { data: summary, refresh: refreshSummary } = useAsyncData(
    () => adminGetReportSummary(...rangeParams(applied)),
    [applied],
  )
  const { data: revenue, refresh: refreshRevenue } = useAsyncData(
    () => adminGetReportRevenue(...rangeParams(applied)),
    [applied],
  )
  const { data: topFoods, refresh: refreshTop } = useAsyncData(
    () => adminGetReportTopFoods(...rangeParams(applied), 10),
    [applied],
  )

  const refreshAll = () => {
    refreshSummary()
    refreshRevenue()
    refreshTop()
  }

  const exportExcel = async () => {
    try {
      const blob = await adminExportReport(...rangeParams(applied))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Xuất Excel thất bại')
    }
  }

  const maxRevenue = Math.max(1, ...(revenue ?? []).map((r) => r.revenue || 0))

  const metrics = [
    { label: 'Doanh thu', value: formatVND(summary?.revenue ?? 0) },
    { label: 'Số đơn', value: `${summary?.orderCount ?? 0}` },
    { label: 'Đơn hoàn thành', value: `${summary?.completedCount ?? 0}` },
    { label: 'Giá trị đơn trung bình', value: formatVND(summary?.avgOrder ?? 0) },
    { label: 'Lượt dùng khuyến mãi', value: `${summary?.promotionUsage ?? 0}` },
    { label: 'Tiền đã giảm', value: formatVND(summary?.promotionDiscount ?? 0) },
  ]

  return (
    <div>
      <PageHeader
        title="Báo cáo"
        subtitle="Doanh thu tính sau giảm giá và không gồm đơn đã hủy."
        extra={
          <UiButton kind="default" icon={<DownloadOutlined />} onClick={() => void exportExcel()}>
            Xuất Excel
          </UiButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3">
        <DatePicker.RangePicker
          value={range}
          onChange={(value) => setRange(value as Range)}
          className="min-w-[280px]"
        />
        <UiButton kind="primary" onClick={() => setApplied(range)}>
          Lọc dữ liệu
        </UiButton>
        {applied && (
          <UiButton
            kind="default"
            onClick={() => {
              setRange(null)
              setApplied(null)
            }}
          >
            Bỏ lọc
          </UiButton>
        )}
        <span className="ml-auto text-xs text-stone-400">
          {applied
            ? `${applied[0].format('DD/MM/YYYY')} – ${applied[1].format('DD/MM/YYYY')}`
            : '30 ngày gần nhất'}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-stone-200 rounded-xl border border-stone-200 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`px-4 py-3.5 ${i < metrics.length - (metrics.length % 2 === 0 ? 2 : 1) ? 'border-b border-stone-200 lg:border-b-0' : ''} ${
              i % 2 === 1 ? 'border-l border-stone-200 lg:border-l-0' : ''
            }`}
          >
            <div className="text-xs text-stone-500">{m.label}</div>
            <div className="mt-1 truncate text-lg font-semibold tabular-nums text-stone-900">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PageCard>
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="font-semibold text-stone-800">Doanh thu theo ngày</h3>
          </div>
          {(revenue?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-400">Chưa có đơn nào trong khoảng này.</p>
          ) : (
            <div className="space-y-3 px-5 py-4">
              {(revenue ?? []).map((r) => (
                <div key={r.date} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-stone-600">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                    <span className="tabular-nums text-stone-900">{formatVND(r.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-amber-600"
                        style={{ width: `${Math.max(3, Math.round((r.revenue / maxRevenue) * 100))}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-stone-400">{r.orders} đơn</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageCard>

        <PageCard>
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="font-semibold text-stone-800">Món bán chạy</h3>
          </div>
          <Table
            rowKey="name"
            dataSource={topFoods ?? []}
            pagination={false}
            size="small"
            locale={{ emptyText: 'Chưa có dữ liệu bán hàng.' }}
            columns={[
              { title: 'Món', dataIndex: 'name' },
              { title: 'Đã bán', dataIndex: 'quantity', render: (v: number) => `${v} phần` },
              {
                title: 'Doanh thu',
                dataIndex: 'revenue',
                align: 'right',
                render: (v: number) => <span className="tabular-nums">{formatVND(v)}</span>,
              },
            ]}
          />
        </PageCard>
      </div>

      <div className="mt-6">
        <PageCard>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
            <h3 className="font-semibold text-stone-800">Chi tiết doanh thu</h3>
            <UiButton kind="default" size="small" onClick={refreshAll}>
              Làm mới
            </UiButton>
          </div>
          <Table
            rowKey="date"
            dataSource={revenue ?? []}
            pagination={{ pageSize: 8 }}
            size="small"
            locale={{ emptyText: 'Chưa có dữ liệu.' }}
            columns={[
              { title: 'Ngày', dataIndex: 'date', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
              {
                title: 'Doanh thu',
                dataIndex: 'revenue',
                align: 'right',
                render: (v: number) => <span className="font-medium tabular-nums text-amber-700">{formatVND(v)}</span>,
              },
              { title: 'Số đơn', dataIndex: 'orders', align: 'right' },
            ]}
          />
        </PageCard>
      </div>
    </div>
  )
}
