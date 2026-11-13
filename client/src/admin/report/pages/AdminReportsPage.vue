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
} from '@/admin/report/api'
import useAsyncData from '@/composables/useAsyncData'
import { formatVND } from '@/shared/utils/format'
import { message } from '@/shared/api/message'
import { ADMIN_THEME_OVERRIDES } from '@/shared/theme'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import type { ChartData, ChartOptions } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Khoang ngay dang xem; null = 30 ngay gan nhat. Input dang timestamp [from, to] ms.
const range = ref<[number, number] | null>(null)
const applied = ref<[number, number] | null>(null)

// Date picker tra ve timestamp nua dem theo gio may chu, nen lay ngay lich theo man hinh
// roi gui chuoi "YYYY-MM-DD" de server doc theo ngay lich Viet Nam.
const pickedDay = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ngay trong bao cao la ngay lich VN dang "YYYY-MM-DD"; hien thi truc tiep de khong lech ngay.
const dayLabel = (day: string): string => {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

const dayParam = (v?: number): string | undefined => (v == null ? undefined : pickedDay(v))

const { data: summary, refresh: refreshSummary } = useAsyncData(
  () => adminGetReportSummary(dayParam(applied.value?.[0]), dayParam(applied.value?.[1])),
  () => [applied.value?.[0], applied.value?.[1]],
)
const { data: revenue, refresh: refreshRevenue } = useAsyncData(
  () => adminGetReportRevenue(dayParam(applied.value?.[0]), dayParam(applied.value?.[1])),
  () => [applied.value?.[0], applied.value?.[1]],
)
const { data: topFoods, refresh: refreshTop } = useAsyncData(
  () => adminGetReportTopFoods(dayParam(applied.value?.[0]), dayParam(applied.value?.[1]), 10),
  () => [applied.value?.[0], applied.value?.[1]],
)
const refreshAll = () => { void refreshSummary(); void refreshRevenue(); void refreshTop() }

const exportExcel = async () => {
  try {
    const blob = await adminExportReport(dayParam(applied.value?.[0]), dayParam(applied.value?.[1]))
    const url = URL.createObjectURL(blob as unknown as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bao-cao-${pickedDay(Date.now())}.xlsx`
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
  labels: (revenue.value ?? []).map((r) => `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}`),
  datasets: [
    {
      label: 'Doanh thu (đ)',
      data: (revenue.value ?? []).map((r) => r.revenue),
      backgroundColor: ADMIN_THEME_OVERRIDES.common.primaryColor,
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
  { title: 'Ngày', key: 'date', render: (row) => dayLabel(row.date) },
  { title: 'Doanh thu', key: 'revenue', align: 'right', render: (row) => h('span', { class: 'text-sm font-medium tabular-nums text-orange-700' }, formatVND(row.revenue)) },
  { title: 'Số đơn', key: 'orders', align: 'right', render: (row) => h('span', { class: 'text-sm tabular-nums' }, row.orders) },
]
const topFoodsColumns: DataTableColumns<{ foodId: number; name: string; quantity: number; revenue: number }> = [
  { title: 'Món', key: 'name', render: (row) => h('span', { class: 'text-sm font-medium text-stone-800' }, row.name) },
  { title: 'Đã bán', key: 'quantity', align: 'right', render: (row) => h('span', { class: 'text-sm tabular-nums' }, `${row.quantity} phần`) },
  { title: 'Doanh thu', key: 'revenue', align: 'right', render: (row) => h('span', { class: 'text-sm tabular-nums' }, formatVND(row.revenue)) },
]
watch(applied, () => { refreshAll() })
</script>

<template>
  <div>
    <PageHeader title="Báo cáo"><template #extra>
      <NButton size="small" @click="exportExcel">
        <template #icon><NIcon :size="15"><DownloadOutline /></NIcon></template>
        Xuất Excel
      </NButton>
    </template></PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white p-2">
      <NDatePicker v-model:value="range" type="daterange" clearable class="min-w-[260px]" size="small" />
      <NButton type="primary" size="small" @click="applied = range">Lọc dữ liệu</NButton>
      <NButton v-if="applied" size="small" @click="() => { range = null; applied = null }">Bỏ lọc</NButton>
      <span class="ml-auto text-xs text-stone-400">
        {{ applied ? `${dayLabel(pickedDay(applied[0]))} – ${dayLabel(pickedDay(applied[1]))}` : '30 ngày gần nhất' }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="m in metrics" :key="m.label" class="rounded-md border border-stone-200 bg-white px-3 py-2.5">
        <div class="text-[11px] uppercase tracking-wide text-stone-500">{{ m.label }}</div>
        <div class="mt-0.5 truncate text-lg font-semibold tabular-nums text-stone-900">{{ m.value }}</div>
      </div>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-2">
      <PageCard>
        <div class="border-b border-stone-100 px-3 py-2.5">
          <h3 class="text-sm font-semibold text-stone-800">Doanh thu theo ngày</h3>
        </div>
        <div v-if="(revenue?.length ?? 0) === 0" class="px-3 py-6 text-center text-sm text-stone-400">Chưa có đơn nào trong khoảng này.</div>
        <div v-else class="h-56 px-3 py-2.5">
          <Bar :data="revenueChartData" :options="revenueChartOptions" />
        </div>
      </PageCard>

      <PageCard>
        <div class="border-b border-stone-100 px-3 py-2.5">
          <h3 class="text-sm font-semibold text-stone-800">Món bán chạy</h3>
        </div>
        <NDataTable :columns="topFoodsColumns" :data="topFoods ?? []" :row-key="(row: { foodId: number }) => row.foodId" :pagination="false" size="small" />
      </PageCard>
    </div>

    <div class="mt-3">
      <PageCard>
        <div class="flex items-center justify-between border-b border-stone-100 px-3 py-2.5">
          <h3 class="text-sm font-semibold text-stone-800">Chi tiết doanh thu</h3>
          <NButton size="small" @click="refreshAll">Làm mới</NButton>
        </div>
        <NDataTable :columns="tableColumns" :data="revenue ?? []" :row-key="(row: { date: string }) => row.date" :pagination="{ pageSize: 8 }" size="small" />
      </PageCard>
    </div>
  </div>
</template>
