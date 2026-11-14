<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NConfigProvider, NEmpty, NIcon, NModal, NSkeleton, NTag, useDialog } from 'naive-ui'
import { CheckmarkCircle, TimeOutline, QrCodeOutline, ImageOutline } from '@vicons/ionicons5'
import QRCode from 'qrcode'
import { cancelOrder, getMyOrders } from '@/user/order/api'
import useAsyncData from '@/composables/useAsyncData'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { canCancelOrder, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, orderCode } from '@/shared/utils/orders'
import { formatVND } from '@/shared/utils/format'
import { message } from '@/shared/api/message'
import OrderTimeline from '@/user/order/components/OrderTimeline.vue'
import type { GlobalThemeOverrides } from 'naive-ui'
import type { Order, OrderStatus } from '@/shared/types'

const HOTLINE = '0292.888.9999'
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

/** Theme chung cua app la amber; trang don hang dung orange cua Tailwind trong pham vi nay. */
const ordersTheme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ea580c',
    primaryColorHover: '#c2410c',
    primaryColorPressed: '#9a3412',
    primaryColorSuppl: '#ea580c',
  },
}

/** Mau NTag theo trang thai don; Naive lo phan to mau, khong viet hex tai cho. */
const STATUS_TAG_TYPE: Record<OrderStatus, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PREPARING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
}

const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (STATUSES as string[]).includes(value)

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const cart = useCartStore()
const ui = useUiStore()

const reorderingId = ref<number | null>(null)
const paying = ref<Order | null>(null)
// Ma QR chi hien thi 1 phut roi het han o phia giao dien; giay con lai de khach doi chieu.
const qrSeconds = ref(60)
const qrDataUrl = ref('')
const qrError = ref('')
let qrTimer: number | undefined
// Moi lan mo modal QR tang so nay; ket qua await cua lan cu khong duoc dung timer cua lan moi.
let qrToken = 0

const startQrTimer = () => {
  window.clearInterval(qrTimer)
  qrTimer = window.setInterval(() => {
    if (qrSeconds.value > 0) qrSeconds.value -= 1
    if (qrSeconds.value === 0) window.clearInterval(qrTimer)
  }, 1000)
}

watch(paying, async (order) => {
  const token = ++qrToken
  window.clearInterval(qrTimer)
  qrTimer = undefined
  qrSeconds.value = 60
  qrDataUrl.value = ''
  qrError.value = ''
  if (order?.paymentMethod !== 'QR') return
  try {
    const url = await QRCode.toDataURL(`FOOD-${order.id}-${order.total}`, {
      errorCorrectionLevel: 'M',
      width: 168,
      margin: 1,
    })
    // Modal da dong hoac doi don trong luc tao anh: bo anh, khong bat timer mo coi.
    if (token !== qrToken || !paying.value) return
    qrDataUrl.value = url
    startQrTimer()
  } catch {
    if (token !== qrToken || !paying.value) return
    qrError.value = 'Không tạo được mã QR. Vui lòng thử lại.'
  }
})
onBeforeUnmount(() => {
  qrToken += 1
  window.clearInterval(qrTimer)
})

/** Nut "Tao ma moi": dong ho cu da dung o 0 nen phai dung lai interval, chi reset so giay la khong du. */
const restartQr = () => {
  qrSeconds.value = 60
  startQrTimer()
}

/** Thu tao lai ma QR khi tao anh that bai. */
const retryQr = () => {
  if (!paying.value) return
  qrError.value = ''
  paying.value = { ...paying.value }
}

const qrExpired = computed(() => paying.value?.paymentMethod === 'QR' && qrSeconds.value === 0)
const qrLabel = computed(() => `${Math.floor(qrSeconds.value / 60)}:${String(qrSeconds.value % 60).padStart(2, '0')}`)

const statusParam = computed(() => route.query.status)
const filter = computed<OrderStatus | 'ALL'>(() => (isOrderStatus(statusParam.value) ? statusParam.value : 'ALL'))
// Thong bao dan toi `/orders?orderId=...`: cuon toi dung don sau khi du lieu tai xong.
const highlightId = computed(() => {
  const parsed = Number(route.query.orderId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const { data: orders, loading, error, refresh } = useAsyncData((signal) => getMyOrders(signal), () => [])

watch(
  [loading, orders, highlightId],
  ([isLoading]) => {
    if (isLoading || highlightId.value === null) return
    document.getElementById(`order-${highlightId.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
  { immediate: true },
)

watch(error, (e) => {
  if (e) message.error('Không tải được danh sách đơn hàng')
})

const setFilter = (next: OrderStatus | 'ALL') => {
  const query = new URLSearchParams()
  for (const [key, raw] of Object.entries(route.query)) {
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value != null && key !== 'orderId') query.set(key, String(value))
  }
  query.delete('status')
  if (next !== 'ALL') query.set('status', next)
  router.replace({ query: Object.fromEntries(query) })
}

const reorder = async (order: Order) => {
  if (reorderingId.value !== null) return
  reorderingId.value = order.id
  const available = order.items.flatMap((i) => (i.food?.available ? [{ food: i.food, quantity: i.quantity }] : []))
  const skipped = order.items.filter((i) => !i.food?.available).map((i) => i.food?.name ?? 'Món đã xóa')
  const failed: string[] = []
  try {
    for (const item of available) {
      // cart.add tra false khi server tu choi (mon vua ngung ban, mat mang): dem lai de
      // khong bao "da them" sai so mon.
      if (!(await cart.add(item.food, item.quantity))) failed.push(item.food.name)
    }
  } finally {
    reorderingId.value = null
  }
  if (available.length === 0) {
    message.warning('Các món trong đơn này đã ngừng phục vụ, không thể đặt lại')
    return
  }
  const added = available.length - failed.length
  if (added === 0) {
    message.error('Không thêm được món nào vào giỏ. Vui lòng thử lại.')
    return
  }
  if (failed.length > 0 || skipped.length > 0) {
    message.warning(`Đã thêm ${added}/${available.length} món vào giỏ. Bỏ qua: ${[...skipped, ...failed].join(', ')}`)
  } else {
    message.success('Đã thêm toàn bộ món vào giỏ')
  }
  ui.openDrawer('cart')
}

const cancel = async (order: Order) => {
  try {
    await cancelOrder(order.id)
    message.success(`Đã hủy đơn #${orderCode(order.id)}`)
    await refresh()
  } catch {
    message.error('Không hủy được đơn này')
    await refresh()
  }
}

// Huy la thao tac khong hoan tac duoc nen phai co buoc xac nhan; server cung kiem lai rang buoc.
const confirmCancel = (order: Order) => {
  dialog.warning({
    title: 'Hủy đơn này?',
    content: 'Bạn chỉ có thể tự hủy đơn khi đơn chưa thanh toán và còn chờ xác nhận.',
    positiveText: 'Hủy đơn',
    negativeText: 'Giữ đơn',
    onPositiveClick: () => cancel(order),
  })
}

// Thanh toan QR/COD hien chi hien thi ma va huong dan; khong tu dong danh dau da thanh toan.

const visible = computed(() => orders.value?.filter((o) => filter.value === 'ALL' || o.status === filter.value) ?? [])
const counts = computed(() => {
  const acc: Record<string, number> = {}
  for (const status of STATUSES) acc[status] = orders.value?.filter((o) => o.status === status).length ?? 0
  return acc
})
const tabClass = (active: boolean) =>
  `inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition ${
    active ? 'bg-orange-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50 hover:text-orange-700'
  }`
</script>

<template>
  <NConfigProvider :theme-overrides="ordersTheme">
    <div class="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div v-if="loading" class="py-8"><NSkeleton :repeat="5" height="56px" /></div>

      <NAlert v-else-if="error" type="error" title="Không tải được đơn hàng" class="mt-2">
        <p class="text-sm">Đã có lỗi khi kết nối máy chủ. Kiểm tra mạng rồi thử lại.</p>
        <NButton class="mt-3" @click="refresh()">Thử lại</NButton>
      </NAlert>

      <NEmpty v-else-if="orders?.length === 0" class="mt-16" description="Bạn chưa có đơn hàng nào">
        <NButton type="primary" class="mt-4" @click="router.push('/')">Khám phá thực đơn ngay</NButton>
      </NEmpty>

      <template v-else>
        <div class="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Lọc theo trạng thái đơn">
          <button type="button" role="tab" :aria-selected="filter === 'ALL'" :class="tabClass(filter === 'ALL')" @click="setFilter('ALL')">
            Tất cả
            <span class="text-[11px] tabular-nums opacity-75">{{ orders?.length ?? 0 }}</span>
          </button>
          <button
            v-for="status in STATUSES"
            :key="status"
            type="button"
            role="tab"
            :aria-selected="filter === status"
            :class="tabClass(filter === status)"
            @click="setFilter(status)"
          >
            {{ ORDER_STATUS_LABEL[status] }}
            <span class="text-[11px] tabular-nums opacity-75">{{ counts[status] }}</span>
          </button>
        </div>

        <NEmpty v-if="visible.length === 0" class="mt-12" description="Không có đơn nào ở trạng thái này" />
        <div v-else class="mt-3 space-y-3">
          <NCard
            v-for="o in visible"
            :id="`order-${o.id}`"
            :key="o.id"
            size="small"
            :bordered="false"
            :content-style="{ padding: '12px' }"
            class="scroll-mt-20 !rounded-xl ring-1 transition"
            :class="o.id === highlightId ? '!ring-2 ring-orange-500' : 'ring-stone-200/70'"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-stone-900">Đơn #{{ orderCode(o.id) }}</p>
                <p class="mt-0.5 text-[11px] text-stone-500">
                  {{ new Date(o.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-1">
                <NTag :type="STATUS_TAG_TYPE[o.status]" size="small" :bordered="false" :round="false">
                  {{ ORDER_STATUS_LABEL[o.status] }}
                </NTag>
                <NTag :type="o.paymentStatus === 'PAID' ? 'success' : 'warning'" size="small" :bordered="false" :round="false">
                  <template #icon>
                    <NIcon :size="11"><CheckmarkCircle v-if="o.paymentStatus === 'PAID'" /><TimeOutline v-else /></NIcon>
                  </template>
                  {{ o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán' }}
                </NTag>
              </div>
            </div>

            <OrderTimeline :status="o.status" />

            <div class="mt-2 divide-y divide-stone-100">
              <div v-for="it in o.items" :key="it.id" class="flex items-center gap-2.5 py-1.5">
                <img v-if="it.food?.imageUrl" :src="it.food.imageUrl" alt="" class="h-9 w-9 shrink-0 rounded-md object-cover" />
                <span v-else class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-stone-100 text-stone-300">
                  <NIcon :size="14"><ImageOutline /></NIcon>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[13px] font-medium text-stone-800">{{ it.food?.name ?? 'Món đã xóa' }}</p>
                  <p class="text-[11px] text-stone-500">{{ it.quantity }} × {{ formatVND(it.price) }}</p>
                </div>
                <span class="shrink-0 text-right text-xs tabular-nums">
                  <span v-if="(it.discountAmount ?? 0) > 0" class="mr-1.5 text-[11px] text-stone-400 line-through">{{ formatVND(it.price * it.quantity) }}</span>
                  <span :class="(it.discountAmount ?? 0) > 0 ? 'font-semibold text-emerald-700' : 'text-stone-800'">{{ formatVND(it.price * it.quantity - (it.discountAmount ?? 0)) }}</span>
                </span>
              </div>
            </div>

            <div v-if="(o.discountTotal ?? 0) > 0" class="mt-1.5 flex items-center justify-between text-xs text-emerald-700">
              <span>Giảm giá</span>
              <span class="tabular-nums">-{{ formatVND(o.discountTotal ?? 0) }}</span>
            </div>

            <p v-if="o.note" class="mt-2 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs leading-relaxed text-orange-900">
              <span class="font-semibold">Lưu ý cho quán:</span> {{ o.note }}
            </p>

            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-2">
              <span class="text-xs text-stone-500">{{ PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod }}</span>
              <span class="text-sm font-bold tabular-nums text-orange-700">{{ formatVND(o.total) }}</span>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <NButton v-if="o.status === 'COMPLETED'" size="small" :loading="reorderingId === o.id" @click="reorder(o)">Đặt lại</NButton>
              <NButton v-if="o.status === 'PENDING' && o.paymentStatus !== 'PAID' && o.paymentMethod === 'QR'" size="small" @click="paying = o">
                <template #icon><NIcon :size="14"><QrCodeOutline /></NIcon></template>
                Thanh toán
              </NButton>
              <NButton
                v-if="canCancelOrder(o)"
                size="small"
                type="error"
                ghost
                @click="confirmCancel(o)"
              >
                Hủy đơn
              </NButton>
              <span v-if="o.status === 'PENDING' && o.paymentStatus === 'PAID'" class="text-[11px] italic text-stone-500">
                Đã thanh toán. Gọi {{ HOTLINE }} nếu cần hủy hoặc hoàn tiền.
              </span>
            </div>
          </NCard>
        </div>
      </template>

      <NModal :show="paying !== null" preset="card" :title="paying ? `Thanh toán đơn #${orderCode(paying.id)}` : ''" :style="{ maxWidth: '26rem' }" @update:show="(v: boolean) => !v && (paying = null)">
        <div v-if="paying" class="flex flex-col items-center gap-2.5 py-1 text-center">
          <div v-if="paying.paymentMethod === 'QR'" class="flex flex-col items-center gap-1.5">
            <div class="relative rounded-md bg-white p-1.5 ring-1 ring-stone-200">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="Mã QR thanh toán" width="168" height="168" />
              <div v-else-if="!qrError" class="grid h-[168px] w-[168px] place-items-center bg-stone-100 text-xs text-stone-500">
                Đang tạo mã QR...
              </div>
              <div v-else class="grid h-[168px] w-[168px] place-items-center bg-stone-100 px-3 text-xs text-red-600">
                {{ qrError }}
              </div>
              <div v-if="qrExpired && qrDataUrl" class="absolute inset-0 grid place-items-center bg-white/80 text-xs font-semibold text-stone-700">
                Mã QR đã hết hạn
              </div>
            </div>
            <button v-if="qrExpired" type="button" class="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50" @click="restartQr">
              Tạo mã mới
            </button>
            <button v-else-if="qrError" type="button" class="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50" @click="retryQr">
              Thử lại
            </button>
            <p v-else class="text-[11px] text-stone-500" aria-live="polite">Mã QR hết hạn sau {{ qrLabel }}</p>
          </div>
          <div class="text-base font-bold text-stone-900">{{ formatVND(paying.total) }}</div>
          <p class="text-[11px] text-stone-500">Quét mã QR để thực hiện giao dịch.</p>
        </div>
      </NModal>
    </div>
  </NConfigProvider>
</template>
