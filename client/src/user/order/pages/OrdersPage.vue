<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton, NEmpty, NIcon, NModal, NSkeleton, useDialog } from 'naive-ui'
import { CheckmarkCircle, TimeOutline, QrCodeOutline, ImageOutline } from '@vicons/ionicons5'
import QRCode from 'qrcode'
import { cancelOrder, getMyOrders } from '@/user/order/api'
import { payOrder } from '@/user/payment/api'
import useAsyncData from '@/composables/useAsyncData'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { canCancelOrder, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, orderCode } from '@/shared/utils/orders'
import { formatVND } from '@/shared/utils/format'
import { message } from '@/shared/api/message'
import OrderTimeline from '@/user/order/components/OrderTimeline.vue'
import type { Order, OrderStatus } from '@/shared/types'

const HOTLINE = '0292.888.9999'
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

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
let qrTimer: number | undefined

watch(paying, async (order) => {
  window.clearInterval(qrTimer)
  qrSeconds.value = 60
  if (order?.paymentMethod === 'QR') {
    qrDataUrl.value = await QRCode.toDataURL(`FOOD-${order.id}-${order.total}`, {
      errorCorrectionLevel: 'M',
      width: 168,
      margin: 1,
    })
    qrTimer = window.setInterval(() => {
      if (qrSeconds.value > 0) qrSeconds.value -= 1
      else window.clearInterval(qrTimer)
    }, 1000)
  }
})
onBeforeUnmount(() => window.clearInterval(qrTimer))

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
  const available = order.items.filter((i) => (i.food ? i.food.available : true))
  const skipped = order.items.filter((i) => i.food && !i.food.available).map((i) => i.food!.name)
  try {
    for (const item of available) {
      if (item.food) await cart.add(item.food, item.quantity)
    }
  } finally {
    reorderingId.value = null
  }
  if (available.length === 0) {
    message.warning('Các món trong đơn này đã ngừng phục vụ, không thể đặt lại')
    return
  }
  message.success(
    skipped.length > 0
      ? `Đã thêm vào giỏ (bỏ qua món ngừng phục vụ: ${skipped.join(', ')})`
      : 'Đã thêm toàn bộ món vào giỏ',
  )
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

const confirmPaid = async () => {
  if (!paying.value || qrExpired.value) return
  try {
    await payOrder(paying.value.id)
    message.success('Đã ghi nhận thanh toán')
    paying.value = null
    await refresh()
  } catch {
    message.error('Không ghi nhận được thanh toán')
  }
}

const visible = computed(() => orders.value?.filter((o) => filter.value === 'ALL' || o.status === filter.value) ?? [])
const counts = computed(() => {
  const acc: Record<string, number> = {}
  for (const status of STATUSES) acc[status] = orders.value?.filter((o) => o.status === status).length ?? 0
  return acc
})
const tabClass = (active: boolean) =>
  `inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    active ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
  }`
</script>

<template>
  <div class="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
    <div v-if="loading" class="py-10"><NSkeleton :repeat="6" height="64px" /></div>

    <NAlert v-else-if="error" type="error" title="Không tải được đơn hàng" class="mt-5">
      <p class="text-sm">Đã có lỗi khi kết nối máy chủ. Kiểm tra mạng rồi thử lại.</p>
      <NButton class="mt-3" @click="refresh()">Thử lại</NButton>
    </NAlert>

    <NEmpty v-else-if="orders?.length === 0" class="mt-16" description="Bạn chưa có đơn hàng nào">
      <NButton type="primary" class="mt-4" @click="router.push('/')">Khám phá thực đơn ngay</NButton>
    </NEmpty>

    <template v-else>
      <div class="-mx-3 mt-5 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Lọc theo trạng thái đơn">
        <button type="button" role="tab" :aria-selected="filter === 'ALL'" :class="tabClass(filter === 'ALL')" @click="setFilter('ALL')">
          Tất cả
          <span class="text-xs tabular-nums opacity-75">{{ orders?.length ?? 0 }}</span>
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
          <span class="text-xs tabular-nums opacity-75">{{ counts[status] }}</span>
        </button>
      </div>

      <NEmpty v-if="visible.length === 0" class="mt-12" description="Không có đơn nào ở trạng thái này" />
      <div v-else class="mt-4 space-y-4">
        <article
          v-for="o in visible"
          :key="o.id"
          :id="`order-${o.id}`"
          class="scroll-mt-20 rounded-2xl bg-white p-4 ring-1 transition sm:p-5"
          :class="o.id === highlightId ? 'ring-2 ring-amber-500' : 'ring-stone-200/70'"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-stone-900">Đơn #{{ orderCode(o.id) }}</p>
              <p class="mt-0.5 text-xs text-stone-500">
                {{ new Date(o.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) }}
              </p>
            </div>
            <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" :class="o.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'">
              <NIcon :size="11"><CheckmarkCircle v-if="o.paymentStatus === 'PAID'" /><TimeOutline v-else /></NIcon>
              {{ o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán' }}
            </span>
          </div>

          <OrderTimeline :status="o.status" />

          <div class="mt-3 space-y-2">
            <div v-for="it in o.items" :key="it.id" class="flex items-center gap-3">
              <img v-if="it.food?.imageUrl" :src="it.food.imageUrl" alt="" class="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <span v-else class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-300">
                <NIcon :size="16"><ImageOutline /></NIcon>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-stone-800">{{ it.food?.name ?? 'Món đã xóa' }}</p>
                <p class="text-xs text-stone-500">{{ it.quantity }} × {{ formatVND(it.price) }}</p>
              </div>
              <span class="shrink-0 text-right text-sm tabular-nums">
                <span v-if="(it.discountAmount ?? 0) > 0" class="mr-1.5 text-xs text-stone-400 line-through">{{ formatVND(it.price * it.quantity) }}</span>
                <span :class="(it.discountAmount ?? 0) > 0 ? 'font-semibold text-emerald-700' : 'text-stone-800'">{{ formatVND(it.price * it.quantity - (it.discountAmount ?? 0)) }}</span>
              </span>
            </div>
          </div>

          <div v-if="(o.discountTotal ?? 0) > 0" class="mt-2 flex items-center justify-between text-sm text-emerald-700">
            <span>Giảm giá</span>
            <span class="tabular-nums">-{{ formatVND(o.discountTotal ?? 0) }}</span>
          </div>

          <p v-if="o.note" class="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
            <span class="font-semibold">Lưu ý cho quán:</span> {{ o.note }}
          </p>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-3 text-sm">
            <span class="text-stone-500">{{ PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod }}</span>
            <span class="text-base font-bold tabular-nums text-amber-800">{{ formatVND(o.total) }}</span>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <NButton v-if="o.status === 'COMPLETED'" :loading="reorderingId === o.id" @click="reorder(o)">Đặt lại</NButton>
            <NButton v-if="o.status === 'PENDING' && o.paymentStatus !== 'PAID'" @click="paying = o">
              <template #icon><NIcon :size="16"><QrCodeOutline /></NIcon></template>
              Thanh toán
            </NButton>
            <NButton
              v-if="canCancelOrder(o)"
              type="error"
              ghost
              @click="confirmCancel(o)"
            >
              Hủy đơn
            </NButton>
            <span v-if="o.status === 'PENDING' && o.paymentStatus === 'PAID'" class="text-xs italic text-stone-500">
              Đã thanh toán. Gọi {{ HOTLINE }} nếu cần hủy hoặc hoàn tiền.
            </span>
          </div>
        </article>
      </div>
    </template>

    <NModal :show="paying !== null" preset="card" :title="paying ? `Thanh toán đơn #${orderCode(paying.id)}` : ''" :style="{ maxWidth: '28rem' }" @update:show="(v: boolean) => !v && (paying = null)">
      <div v-if="paying" class="flex flex-col items-center gap-3 py-2 text-center">
        <div class="text-sm text-stone-500">Phương thức: {{ PAYMENT_METHOD_LABEL[paying.paymentMethod] ?? paying.paymentMethod }}</div>
        <div v-if="paying.paymentMethod === 'QR'" class="flex flex-col items-center gap-1.5">
          <div class="relative">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="Mã QR thanh toán" width="168" height="168" />
            <div v-if="qrExpired" class="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-stone-700">
              Mã QR đã hết hạn
            </div>
          </div>
          <button v-if="qrExpired" type="button" class="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50" @click="qrSeconds = 60">
            Tạo mã mới
          </button>
          <p v-else class="text-xs text-stone-500" aria-live="polite">Mã QR hết hạn sau {{ qrLabel }}</p>
        </div>
        <div class="text-lg font-bold text-stone-900">{{ formatVND(paying.total) }}</div>
        <NAlert type="warning" title="Thanh toán thử nghiệm" class="w-full text-left">
          <p class="text-xs">
            {{ paying.paymentMethod === 'QR' ? 'Mã QR chỉ để nhận dạng đơn, chưa chuyển tiền thật. Bấm "Xác nhận đã thanh toán" bên dưới để ghi nhận.' : 'Bạn trả tiền mặt khi nhận món. Bấm "Xác nhận đã thanh toán" bên dưới để ghi nhận.' }}
          </p>
        </NAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="paying = null">Quay lại</NButton>
          <NButton type="primary" size="large" :disabled="qrExpired" @click="confirmPaid">Xác nhận đã thanh toán</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
