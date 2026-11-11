<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { adminGetOrders, adminGetReportSummary, adminGetReportTopFoods, adminUpdateOrderStatus } from '@/modules/admin/api'
import useAsyncData from '@/composables/useAsyncData'
import type { Order } from '@/shared/types'
import { orderCode } from '@/shared/utils/orders'
import { formatVND, formatRelativeTime } from '@/shared/utils/format'
import { message } from '@/shared/api/message'
import PageCard from '@/modules/admin/components/PageCard.vue'

/**
 * Tong quan danh cho quan tri: chi so chinh, don dang cho va mon ban chay. Trang co y
 * khong dung the nhieu mau hay bieu do cau ky; viec can lam (duyet don) nam ngay tren dau.
 */
const router = useRouter()
const approving = ref<number | null>(null)

onMounted(() => { document.title = 'Tổng quan · Quản trị' })

const { data: summary, refresh: refreshSummary } = useAsyncData(() => adminGetReportSummary(), () => [])
const { data: orders, refresh: refreshOrders } = useAsyncData(() => adminGetOrders(), () => [])
const { data: topFoods } = useAsyncData(() => adminGetReportTopFoods(undefined, undefined, 5), () => [])

const pending = computed(() => (orders.value ?? []).filter((o) => o.status === 'PENDING').slice(0, 6))
const maxTop = computed(() => Math.max(1, ...(topFoods.value ?? []).map((f) => f.quantity)))
const metrics = computed(() => [
  { label: 'Doanh thu 30 ngày', value: formatVND(summary.value?.revenue ?? 0) },
  { label: 'Đơn hàng', value: `${summary.value?.orderCount ?? 0}` },
  { label: 'Giá trị đơn trung bình', value: formatVND(summary.value?.avgOrder ?? 0) },
  { label: 'Khách đã đặt', value: `${summary.value?.customerCount ?? 0}` },
])

const approve = async (order: Order) => {
  approving.value = order.id
  try {
    await adminUpdateOrderStatus(order.id, 'CONFIRMED')
    message.success(`Đã xác nhận đơn ${orderCode(order.id)}`)
    await Promise.all([refreshOrders(), refreshSummary()])
  } catch {
    message.error('Không xác nhận được đơn này')
  } finally {
    approving.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-2xl font-bold tracking-tight text-stone-900">Tổng quan</h2>
      <NButton @click="router.push('/admin/reports')">Xem báo cáo</NButton>
    </div>

    <div class="grid grid-cols-2 divide-stone-200 rounded-xl border border-stone-200 bg-white sm:grid-cols-4 sm:divide-x">
      <div v-for="(m, i) in metrics" :key="m.label" class="px-5 py-4" :class="[i < 2 ? 'border-b border-stone-200 sm:border-b-0' : '', i % 2 === 1 ? 'border-l border-stone-200 sm:border-l-0' : '']">
        <div class="text-xs text-stone-500">{{ m.label }}</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{{ m.value }}</div>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <PageCard>
        <div class="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div>
            <h3 class="font-semibold text-stone-800">Đơn chờ xác nhận</h3>
            <p class="mt-0.5 text-xs text-stone-500">
              {{ pending.length === 0 ? 'Không còn đơn nào đang chờ.' : `${pending.length} đơn cần xử lý` }}
            </p>
          </div>
          <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-amber-700 hover:underline" @click="router.push('/admin/orders')">
            Tất cả đơn
          </button>
        </div>
        <p v-if="pending.length === 0" class="px-5 py-8 text-center text-sm text-stone-400">Hộp đơn đang trống.</p>
        <ul v-else class="divide-y divide-stone-100">
          <li v-for="o in pending" :key="o.id" class="flex items-center gap-3 px-5 py-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-stone-800">{{ orderCode(o.id) }}</span>
                <span class="text-xs text-stone-400">{{ formatRelativeTime(o.createdAt) }}</span>
              </div>
              <div class="mt-0.5 truncate text-xs text-stone-500">
                {{ o.receiverName }} · {{ o.items.length }} món · {{ formatVND(o.total) }}
              </div>
            </div>
            <NButton type="primary" size="small" :loading="approving === o.id" @click="approve(o)">Xác nhận</NButton>
          </li>
        </ul>
      </PageCard>

      <PageCard>
        <div class="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div>
            <h3 class="font-semibold text-stone-800">Món bán chạy</h3>
            <p class="mt-0.5 text-xs text-stone-500">Theo số phần đã bán trong 30 ngày.</p>
          </div>
          <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-amber-700 hover:underline" @click="router.push('/admin/reports')">
            Chi tiết
          </button>
        </div>
        <p v-if="!topFoods || topFoods.length === 0" class="px-5 py-8 text-center text-sm text-stone-400">Chưa có dữ liệu bán hàng.</p>
        <ul v-else class="space-y-3 px-5 py-4">
          <li v-for="f in topFoods" :key="f.name">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="min-w-0 truncate text-stone-700">{{ f.name }}</span>
              <span class="shrink-0 tabular-nums text-stone-500">{{ f.quantity }} phần</span>
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div class="h-full rounded-full bg-amber-600" :style="{ width: `${Math.max(4, Math.round((f.quantity / maxTop) * 100))}%` }" />
            </div>
          </li>
        </ul>
      </PageCard>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <RouterLink v-for="shortcut in [
        { to: '/admin/foods', label: 'Quản lý món ăn', hint: 'Giá, ảnh, trạng thái phục vụ' },
        { to: '/admin/promotions', label: 'Chương trình khuyến mãi', hint: 'Giảm giá tự động theo dòng món' },
        { to: '/admin/chatbot', label: 'Cấu hình chatbot', hint: 'Nhà cung cấp AI và mô hình' },
      ]" :key="shortcut.to" :to="shortcut.to" class="rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-amber-400">
        <div class="text-sm font-medium text-stone-800">{{ shortcut.label }}</div>
        <div class="mt-0.5 text-xs text-stone-500">{{ shortcut.hint }}</div>
      </RouterLink>
    </div>
  </div>
</template>
