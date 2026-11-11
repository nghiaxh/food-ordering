<script setup lang="ts">
import { computed, h } from 'vue'
import { NDrawer, NButton, NIcon, NSkeleton } from 'naive-ui'
import { CartOutline, Add } from '@vicons/ionicons5'
import { RouterLink, useRouter } from 'vue-router'
import { getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import useCartQuote from '@/composables/useCartQuote'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { formatVND } from '@/shared/utils/format'
import type { Food } from '@/shared/types'
import { discountText } from '@/shared/utils/food-tags'
import { message } from '@/shared/api/message'
import QuantityStepper from '@/components/QuantityStepper.vue'

/** Chi goi y nhom de ghep them vao bua, khong day mon chinh trung voi gio. */
const RELATED_CATEGORIES = ['Đồ uống', 'Tráng miệng']

const ui = useUiStore()
const router = useRouter()
const cart = useCartStore()
const show = computed(() => ui.activeDrawer === 'cart')
const onClose = () => ui.closeDrawer()

const { quote, quoteLoading, quoteError, quoteStale, retry } = useCartQuote(() => cart.items)

// Mon goi y lay mot lan khi mo drawer; loc lai theo gio hien tai de vua them xong la bien mat.
const { data: relatedItems } = useAsyncData((signal) => getFoods(undefined, signal), () => [])
const suggestions = computed(() => {
  const inCart = new Set(cart.items.map((i) => i.food?.id))
  return (relatedItems.value ?? [])
    .filter(
      (f) =>
        f.available &&
        !inCart.has(f.id) &&
        f.category !== null &&
        RELATED_CATEGORIES.includes(f.category.name),
    )
    .sort((a, b) => (a.discountedPrice ?? a.price) - (b.discountedPrice ?? b.price))
    .slice(0, 3)
})

/**
 * Xoa thang khong hoi lai, nhung de duong lui trong 5 giay: khach bam nham van lay lai
 * duoc dung mon va dung so phan. naive-ui message khong co action prop nhung content
 * nhan render function nen dung nut Hoan tac truc tiep trong thong bao.
 */
const removeLine = (food: Food, quantity: number) => {
  void cart.remove(food.id)
  message.success(
    () =>
      h('span', { class: 'flex items-center gap-3' }, [
        h('span', { class: 'min-w-0 truncate' }, `Đã xóa ${food.name}`),
        h(
          'button',
          {
            type: 'button',
            class:
              'shrink-0 cursor-pointer border-0 bg-transparent p-0 font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900',
            onClick: () => void cart.add(food, quantity),
          },
          'Hoàn tác',
        ),
      ]),
    { duration: 5000 },
  )
}

const discountTotal = computed(() => quote.value?.discountTotal ?? 0)
</script>

<template>
  <NDrawer
    :show="show"
    placement="right"
    :width="'min(480px, 100vw)'"
    :mask-closable="true"
    :auto-focus="false"
    @update:show="(v: boolean) => !v && onClose()"
  >
    <template #header>
      <span class="flex items-center gap-2">
        <span class="text-base font-semibold text-stone-900">Giỏ hàng</span>
        <span v-if="cart.items.length > 0" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
          {{ cart.items.length }}
        </span>
      </span>
    </template>

    <template #default>
      <!-- Noi dung mount khi mo de khong goi bao gia o moi trang. -->
      <div v-if="!cart.loaded" class="p-5">
        <NSkeleton :repeat="4" height="52px" />
      </div>

      <div v-else-if="cart.items.length === 0" class="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <span class="grid h-14 w-14 place-items-center rounded-full bg-stone-100 text-stone-300">
          <NIcon :size="24"><CartOutline /></NIcon>
        </span>
        <p class="text-base font-semibold text-stone-900">Giỏ hàng đang trống</p>
        <p class="text-sm leading-relaxed text-stone-500">Chọn vài món từ thực đơn, hoặc hỏi trợ lý AI để được gợi ý.</p>
        <NButton type="primary" class="mt-2" @click="() => { onClose(); router.push('/') }">Xem thực đơn</NButton>
      </div>

      <div v-else class="flex h-full flex-col">
        <div class="flex-1 overflow-y-auto px-4 pb-3">
          <div
            v-for="item in cart.items"
            :key="item.food?.id"
            data-testid="cart-line"
            class="flex gap-3 border-b border-stone-100 py-3.5 last:border-0"
          >
            <RouterLink v-if="item.food" :to="`/foods/${item.food.id}`" class="shrink-0 self-start" @click="onClose">
              <img :src="item.food.imageUrl ?? ''" :alt="item.food.name" loading="lazy" class="h-16 w-16 rounded-xl object-cover" />
            </RouterLink>

            <div v-if="item.food" class="min-w-0 flex-1">
              <RouterLink :to="`/foods/${item.food.id}`" class="line-clamp-2 block text-sm font-semibold leading-snug text-stone-900 hover:text-amber-700" @click="onClose">
                {{ item.food.name }}
              </RouterLink>
              <p
                class="mt-0.5 text-xs"
                :aria-label="(quote?.lines.find(l => l.foodId === item.food!.id)?.lineDiscount ?? 0) > 0 ? `Có khuyến mãi` : undefined"
              >
                <template v-if="(quote?.lines.find(l => l.foodId === item.food!.id)?.lineDiscount ?? 0) > 0">
                  <span class="mr-1 text-stone-400 line-through">{{ formatVND(quote?.lines.find(l => l.foodId === item.food!.id)?.unitPrice ?? item.food.price) }}</span>
                </template>
                <span class="font-medium text-stone-800">
                  {{ formatVND(quote ? (quote.lines.find(l => l.foodId === item.food!.id)!.lineTotal / quote.lines.find(l => l.foodId === item.food!.id)!.quantity) : (item.food.discountedPrice ?? item.food.price)) }}
                </span>
                <span v-if="item.quantity > 1" class="text-stone-500"> / phần</span>
              </p>
              <span v-if="(quote?.lines.find(l => l.foodId === item.food!.id)?.lineDiscount ?? 0) > 0" class="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {{ discountText(quote?.lines.find(l => l.foodId === item.food!.id)?.discountLabel) ?? 'Ưu đãi' }}
                <span class="tabular-nums">-{{ formatVND(quote?.lines.find(l => l.foodId === item.food!.id)?.lineDiscount ?? 0) }}</span>
              </span>
              <p v-if="!item.food.available" class="mt-0.5 text-xs font-medium text-red-600">Món đã ngừng phục vụ</p>

              <div class="mt-2 flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-1">
                  <QuantityStepper
                    :value="item.quantity"
                    size="sm"
                    :disabled="!item.food.available"
                    :label="`Số lượng ${item.food.name}`"
                    @update:value="(value: number) => cart.setQuantity(item.food!.id, value)"
                  />
                  <button
                    type="button"
                    :aria-label="`Xóa ${item.food.name}`"
                    class="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-red-600"
                    @click="removeLine(item.food, item.quantity)"
                  >
                    Xóa
                  </button>
                </div>
                <span data-testid="cart-line-total" class="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                  {{ formatVND(quote?.lines.find(l => l.foodId === item.food!.id)?.lineTotal ?? (item.food.discountedPrice ?? item.food.price) * item.quantity) }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="suggestions.length > 0" class="mt-1 border-t border-stone-100 pt-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Thêm cho bữa này</p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <div v-for="food in suggestions" :key="food.id" class="min-w-0">
                <div class="relative">
                  <RouterLink :to="`/foods/${food.id}`" class="block" @click="onClose">
                    <img :src="food.imageUrl ?? ''" :alt="food.name" loading="lazy" class="aspect-square w-full rounded-lg object-cover" />
                  </RouterLink>
                  <button
                    type="button"
                    :aria-label="`Thêm ${food.name} vào giỏ`"
                    class="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-amber-700 text-white shadow-sm ring-2 ring-white transition hover:bg-amber-800"
                    @click="cart.add(food, 1)"
                  >
                    <NIcon :size="13"><Add /></NIcon>
                  </button>
                </div>
                <RouterLink :to="`/foods/${food.id}`" class="mt-1.5 line-clamp-2 block text-[11px] leading-snug text-stone-700 hover:text-amber-800" @click="onClose">
                  {{ food.name }}
                </RouterLink>
                <p class="text-[11px] font-semibold tabular-nums text-stone-900">{{ formatVND(food.discountedPrice ?? food.price) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="shrink-0 border-t border-stone-200 bg-white">
          <div class="bg-stone-50/70 px-4 py-2.5">
            <template v-if="quote">
              <template v-if="discountTotal > 0">
                <div class="flex justify-between text-sm text-stone-600"><span>Tạm tính</span><span class="tabular-nums">{{ formatVND(quote.subtotal) }}</span></div>
                <div class="mt-0.5 flex justify-between text-sm text-emerald-600"><span>Giảm giá</span><span class="tabular-nums">-{{ formatVND(discountTotal) }}</span></div>
              </template>
              <div class="mt-1 flex items-baseline justify-between border-t border-stone-200 pt-1.5">
                <span class="text-sm font-semibold text-stone-900">Tổng thanh toán</span>
                <span data-testid="cart-total" class="text-lg font-bold tabular-nums text-amber-800 transition-opacity" :class="quoteStale ? 'opacity-60' : ''">{{ formatVND(quote.total) }}</span>
              </div>
            </template>
            <div v-else-if="quoteError" class="flex min-h-14 items-center justify-between gap-2 text-sm text-stone-600">
              <span>Không tính được giá.</span>
              <button type="button" class="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50" @click="retry">Thử lại</button>
            </div>
            <p v-else class="flex min-h-14 items-center text-sm text-stone-500">Đang cập nhật giá…</p>
          </div>

          <div class="px-4 pt-2" :style="{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }">
            <NButton
              type="primary"
              size="large"
              strong
              block
              :disabled="!quote || quoteLoading || quoteError"
              @click="() => { onClose(); router.push('/checkout') }"
            >
              Đặt món
            </NButton>
            <div class="mt-1 flex items-center justify-between gap-2">
              <span class="min-h-4 min-w-0 truncate text-xs text-stone-500" aria-live="polite">
                {{ quoteStale || !quote ? 'Đang cập nhật giá…' : discountTotal > 0 ? 'Đã áp khuyến mãi tốt nhất cho từng món' : '' }}
              </span>
              <button type="button" class="shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-1 py-1 text-xs font-medium text-stone-500 transition hover:text-stone-800" @click="onClose">
                Chọn thêm món
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </NDrawer>
</template>
