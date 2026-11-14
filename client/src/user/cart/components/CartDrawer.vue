<script setup lang="ts">
import { computed, h } from 'vue'
import { NCard, NConfigProvider, NDrawer, NButton, NIcon, NSkeleton, NTag } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import { CartOutline } from '@vicons/ionicons5'
import { RouterLink, useRouter } from 'vue-router'
import useCartQuote from '@/composables/useCartQuote'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { formatVND } from '@/shared/utils/format'
import type { CartItem, Food } from '@/shared/types'
import { discountText } from '@/shared/utils/food-tags'
import { message } from '@/shared/api/message'
import QuantityStepper from '@/components/QuantityStepper.vue'

/**
 * Naive lay mau tu theme chung dang amber. Gio hang chuyen sang orange cua Tailwind
 * trong pham vi drawer nay de nut va tong tien cung mot tong mau.
 */
const cartTheme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ea580c',
    primaryColorHover: '#c2410c',
    primaryColorPressed: '#9a3412',
    primaryColorSuppl: '#ea580c',
  },
  Drawer: {
    bodyPadding: '0',
    headerPadding: '12px 16px',
  },
}

/** Naive chi nhan mau qua prop, dung dung bac orange cua Tailwind. */
const COUNT_TAG_COLOR = { color: '#fff7ed', textColor: '#c2410c' }

const ui = useUiStore()
const router = useRouter()
const cart = useCartStore()
const show = computed(() => ui.activeDrawer === 'cart')
const onClose = () => ui.closeDrawer()

const { quote, quoteLoading, quoteError, quoteStale, retry } = useCartQuote(() => cart.items)

// Tra cuu dong bao gia mot lan thay vi find lap lai trong template.
const quoteLines = computed(
  () => new Map((quote.value?.lines ?? []).map((line) => [line.foodId, line])),
)
const lineOf = (foodId: number) => quoteLines.value.get(foodId) ?? null
const lineDiscountOf = (foodId: number) => lineOf(foodId)?.lineDiscount ?? 0
const unitPriceOf = (item: CartItem) => {
  const line = item.food ? lineOf(item.food.id) : null
  return line ? line.lineTotal / line.quantity : (item.food?.discountedPrice ?? item.food?.price ?? 0)
}
const lineTotalOf = (item: CartItem) => {
  const line = item.food ? lineOf(item.food.id) : null
  return line?.lineTotal ?? (item.food?.discountedPrice ?? item.food?.price ?? 0) * item.quantity
}

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
              'shrink-0 cursor-pointer border-0 bg-transparent p-0 font-semibold text-orange-600 underline underline-offset-2 hover:text-orange-800',
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
  <NConfigProvider :theme-overrides="cartTheme">
    <NDrawer
      :show="show"
      placement="right"
      :width="'min(420px, 100vw)'"
      :mask-closable="true"
      :auto-focus="false"
      @update:show="(v: boolean) => !v && onClose()"
    >
      <template #header>
        <span class="flex items-center gap-2">
          <span class="text-base font-semibold text-stone-900">Giỏ hàng</span>
          <NTag
            v-if="cart.items.length > 0"
            size="small"
            :bordered="false"
            :color="COUNT_TAG_COLOR"
          >
            {{ cart.items.length }}
          </NTag>
        </span>
      </template>

      <template #default>
        <!-- Noi dung mount khi mo de khong goi bao gia o moi trang. -->
        <div v-if="!cart.loaded" class="p-4">
          <NSkeleton :repeat="4" height="44px" />
        </div>

        <div
          v-else-if="cart.items.length === 0"
          class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
        >
          <span class="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-400">
            <NIcon :size="22"><CartOutline /></NIcon>
          </span>
          <p class="text-base font-semibold text-stone-900">Giỏ hàng đang trống</p>
          <p class="text-[13px] leading-relaxed text-stone-500">Chọn vài món từ thực đơn, hoặc hỏi trợ lý AI để được gợi ý.</p>
          <NButton type="primary" size="small" class="mt-1" @click="() => { onClose(); router.push('/') }">Xem thực đơn</NButton>
        </div>

        <div v-else class="flex h-full flex-col">
          <div class="flex-1 overflow-y-auto px-4 pb-2">
            <div
              v-for="item in cart.items"
              :key="item.food?.id"
              data-testid="cart-line"
              class="flex gap-3 border-b border-stone-100 py-2.5 last:border-0"
            >
              <RouterLink v-if="item.food" :to="`/foods/${item.food.id}`" class="shrink-0 self-start" @click="onClose">
                <img :src="item.food.imageUrl ?? ''" :alt="item.food.name" loading="lazy" class="h-14 w-14 rounded-lg object-cover" />
              </RouterLink>

              <div v-if="item.food" class="min-w-0 flex-1">
                <RouterLink
                  :to="`/foods/${item.food.id}`"
                  :title="item.food.name"
                  class="line-clamp-1 block text-[13px] font-semibold leading-snug text-stone-900 hover:text-orange-700"
                  @click="onClose"
                >
                  {{ item.food.name }}
                </RouterLink>
                <p
                  class="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs"
                  :aria-label="lineDiscountOf(item.food.id) > 0 ? `Có khuyến mãi` : undefined"
                >
                  <span v-if="lineDiscountOf(item.food.id) > 0" class="text-stone-400 line-through">
                    {{ formatVND(lineOf(item.food.id)?.unitPrice ?? item.food.price) }}
                  </span>
                  <span class="font-medium text-stone-800">{{ formatVND(unitPriceOf(item)) }}</span>
                  <span v-if="item.quantity > 1" class="text-stone-500">/ phần</span>
                </p>
                <NTag v-if="lineDiscountOf(item.food.id) > 0" size="small" type="success" :bordered="false" class="mr-1 mt-1">
                  {{ discountText(lineOf(item.food.id)?.discountLabel) ?? 'Ưu đãi' }}
                  <span class="ml-1 tabular-nums">-{{ formatVND(lineDiscountOf(item.food.id)) }}</span>
                </NTag>
                <NTag v-if="!item.food.available" size="small" type="error" :bordered="false" class="mt-1">Món đã ngừng phục vụ</NTag>

                <div class="mt-1.5 flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1">
                    <QuantityStepper
                      :value="item.quantity"
                      size="sm"
                      :disabled="!item.food.available"
                      :label="`Số lượng ${item.food.name}`"
                      @update:value="(value: number) => cart.setQuantity(item.food!.id, value)"
                    />
                    <NButton
                      text
                      size="small"
                      :aria-label="`Xóa ${item.food.name}`"
                      @click="removeLine(item.food, item.quantity)"
                    >
                      Xóa
                    </NButton>
                  </div>
                  <span data-testid="cart-line-total" class="shrink-0 text-[13px] font-semibold tabular-nums text-stone-900">
                    {{ formatVND(lineTotalOf(item)) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="shrink-0 border-t border-stone-200 bg-white">
            <!-- Naive dat background-color tren .n-card nen Tailwind bg-orange-50 khong thang; inline giu dung orange-50. -->
            <NCard
              size="small"
              :bordered="false"
              :content-style="{ padding: '8px 16px' }"
              :style="{ backgroundColor: '#fff7ed' }"
            >
              <template v-if="quote">
                <div v-if="discountTotal > 0" class="space-y-0.5 text-xs text-stone-500">
                  <div class="flex justify-between"><span>Tạm tính</span><span class="tabular-nums">{{ formatVND(quote.subtotal) }}</span></div>
                  <div class="flex justify-between text-emerald-600"><span>Giảm giá</span><span class="tabular-nums">-{{ formatVND(discountTotal) }}</span></div>
                </div>
                <div
                  class="flex items-baseline justify-between gap-3"
                  :class="discountTotal > 0 ? 'mt-1.5 border-t border-orange-200/70 pt-1.5' : ''"
                >
                  <span class="text-[13px] font-medium text-stone-600">Tổng thanh toán</span>
                  <span data-testid="cart-total" class="text-lg font-bold tabular-nums text-orange-700 transition-opacity" :class="quoteStale ? 'opacity-60' : ''">{{ formatVND(quote.total) }}</span>
                </div>
              </template>
              <div v-else-if="quoteError" class="flex min-h-10 items-center justify-between gap-2 text-xs text-stone-600">
                <span>Không tính được giá.</span>
                <NButton text size="small" type="primary" @click="retry">Thử lại</NButton>
              </div>
              <p v-else class="flex min-h-10 items-center text-xs text-stone-500">Đang cập nhật giá…</p>
            </NCard>

            <div class="px-4 pt-2" :style="{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }">
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
                <span class="min-h-4 min-w-0 truncate text-[11px] text-stone-500" aria-live="polite">
                  {{ quoteStale || !quote ? 'Đang cập nhật giá…' : discountTotal > 0 ? 'Đã áp khuyến mãi tốt nhất cho từng món' : '' }}
                </span>
                <NButton text size="small" class="shrink-0" @click="onClose">Chọn thêm món</NButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </NDrawer>
  </NConfigProvider>
</template>
