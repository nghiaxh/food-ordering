<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { NButton, NDataTable, NDatePicker, NIcon, type DataTableColumns } from 'naive-ui'
import { DownloadOutline } from '@vicons/ionicons5'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import {
  adminExportReport,
  adminGetReportRevenue,
  adminGetReportSummary,
  adminGetReportTopFoods,
} from '@/modules/admin/api'
import useAsyncData from '@/composables/useAsyncData'
import { formatVND } from '@/shared/utils/format'
import { message } from '@/shared/api/message'
import PageCard from '@/modules/admin/components/PageCard.vue'
import PageHeader from '@/modules/admin/components/PageHeader.vue'
import type { ChartData, ChartOptions } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Khoang ngay dang xem; null = 30 ngay gan nhat. Input dang timestamp [from, to] ms.
const range = ref<[number, number] | null>(null)
const applied = ref<[number, number] | null>(null)

const iso = (v?: number): string | undefined => (v == null ? undefined : new Date(v).toISOString())

const { data: summary, refresh: refreshSummary } = useAsyncData(
  () => adminGetReportSummary(iso(applied.value?.[0]), iso(applied.value?.[1])),
  () => [applied.value?.[0], applied.value?.[1]],
)
const { data: revenue, refresh: refreshRevenue } = useAsyncData(
  () => adminGetReportRevenue(iso(applied.value?.[0]), iso(applied.value?.[1])),
  () => [applied.value?.[0], applied.value?.[1]],
)
const { data: topFoods, refresh: refreshTop } = useAsyncData(
  () => adminGetReportTopFoods(iso(applied.value?.[0]), iso(applied.value?.[1]), 10),
  () => [applied.value?.[0], applied.value?.[1]],
)
const refreshAll = () => { void refreshSummary(); void refreshRevenue(); void refreshTop() }

const exportExcel = async () => {
  try {
    const blob = await adminExportReport(iso(applied.value?.[0]), iso(applied.value?.[1]))
    const url = URL.createObjectURL(blob as unknown as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    message.error('Xuất Excel thất bại')
  }
}

const metrics = computed(() => [
  { label: 'Doanh thu', value: formatVND(summary.value?.revenue ?? 0) },
  { label: 'Số đơn', value: `${summary.value?.orderCount ?? 0}` },
  { label: 'Đơn hoàn thành', value: `${summary.value?.completedCount ?? 0}` },
  { label: 'Giá trị đơn trung bình', value: formatVND(summary.value?.avgOrder ?? 0) },
  { label: 'Tiền đã giảm', value: formatVND(summary.value?.promotionDiscount ?? 0) },
])

const revenueChartData = computed<ChartData<'bar'>>(() => ({
  labels: (revenue.value ?? []).map((r) => new Date(r.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })),
  datasets: [
    {
      label: 'Doanh thu (đ)',
      data: (revenue.value ?? []).map((r) => r.revenue),
      backgroundColor: '#b45309',
      borderRadius: 4,
    },
  ],
}))
const revenueChartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { title: { display: false } },
    y: { beginAtZero: true },
  },
}))
const tableColumns: DataTableColumns<{ date: string; revenue: number; orders: number }> = [
  { title: 'Ngày', key: 'date', render: (row) => new Date(row.date).toLocaleDateString('vi-VN') },
  { title: 'Doanh thu', key: 'revenue', align: 'right', render: (row) => h('span', { class: 'font-medium tabular-nums text-amber-700' }, formatVND(row.revenue)) },
  { title: 'Số đơn', key: 'orders', align: 'right' },
]
const topFoodsColumns: DataTableColumns<{ name: string; quantity: number; revenue: number }> = [
  { title: 'Món', key: 'name' },
  { title: 'Đã bán', key: 'quantity', align: 'right', render: (row) => `${row.quantity} phần` },
  { title: 'Doanh thu', key: 'revenue', align: 'right', render: (row) => h('span', { class: 'tabular-nums' }, formatVND(row.revenue)) },
]
watch(applied, () => { refreshAll() })
</script>

<template>
  <div>
    <PageHeader title="Báo cáo"><template #extra>
      <NButton @click="exportExcel">
        <template #icon><NIcon :size="16"><DownloadOutline /></NIcon></template>
        Xuất Excel
      </NButton>
    </template></PageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3">
      <NDatePicker v-model:value="range" type="daterange" clearable class="min-w-[280px]" size="medium" />
      <NButton type="primary" size="small" @click="applied = range">Lọc dữ liệu</NButton>
      <NButton v-if="applied" size="small" @click="() => { range = null; applied = null }">Bỏ lọc</NButton>
      <span class="ml-auto text-xs text-stone-400">
        {{ applied ? `${new Date(applied[0]).toLocaleDateString('vi-VN')} – ${new Date(applied[1]).toLocaleDateString('vi-VN')}` : '30 ngày gần nhất' }}
      </span>
    </div>

    <div class="grid grid-cols-2 divide-stone-200 rounded-xl border border-stone-200 bg-white sm:grid-cols-5 sm:divide-x">
      <div v-for="m in metrics" :key="m.label" class="border-b border-stone-200 px-4 py-3.5 last:border-b-0 sm:border-b-0">
        <div class="text-xs text-stone-500">{{ m.label }}</div>
        <div class="mt-1 truncate text-lg font-semibold tabular-nums text-stone-900">{{ m.value }}</div>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <PageCard>
        <div class="border-b border-stone-100 px-5 py-3.5">
          <h3 class="font-semibold text-stone-800">Doanh thu theo ngày</h3>
        </div>
        <div v-if="(revenue?.length ?? 0) === 0" class="px-5 py-8 text-center text-sm text-stone-400">Chưa có đơn nào trong khoảng này.</div>
        <div v-else class="h-64 px-5 py-4">
          <Bar :data="revenueChartData" :options="revenueChartOptions" />
        </div>
      </PageCard>

      <PageCard>
        <div class="border-b border-stone-100 px-5 py-3.5">
          <h3 class="font-semibold text-stone-800">Món bán chạy</h3>
        </div>
        <NDataTable :columns="topFoodsColumns" :data="topFoods ?? []" :row-key="(row: { name: string }) => row.name" :pagination="false" size="small" />
      </PageCard>
    </div>

    <div class="mt-6">
      <PageCard>
        <div class="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <h3 class="font-semibold text-stone-800">Chi tiết doanh thu</h3>
          <NButton size="small" @click="refreshAll">Làm mới</NButton>
        </div>
        <NDataTable :columns="tableColumns" :data="revenue ?? []" :row-key="(row: { date: string }) => row.date" :pagination="{ pageSize: 8 }" size="small" />
      </PageCard>
    </div>
  </div>
</template>
