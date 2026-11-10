<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutline, Checkmark } from '@vicons/ionicons5'
import type { OrderStatus } from '@/shared/types'
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '@/shared/utils/orders'

/**
 * Tiến trình đơn tự vẽ: chỉ đánh dấu bước hiện tại, không bịa mốc giờ; đơn đã hủy thì
 * không vẽ dãy bước. Đường nối chạy từ tâm bước đầu tới tâm bước cuối.
 * Tính ở script (isCompleted boolean) để template không bị narrow type lẫn lộn.
 */
const props = defineProps<{ status: OrderStatus }>()
const isCompleted = computed(() => props.status === 'COMPLETED')
const current = computed(() => ORDER_FLOW.indexOf(props.status))
const progress = computed(() =>
  isCompleted.value ? 100 : (current.value / Math.max(1, ORDER_FLOW.length - 1)) * 100,
)
const isDone = (index: number) => index < current.value || isCompleted.value
const isActive = (index: number) => index === current.value && !isCompleted.value
</script>

<template>
  <p v-if="props.status === 'CANCELLED'" class="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
    <NIcon :size="13"><CloseOutline /></NIcon>
    Đơn đã hủy
  </p>

  <ol v-else class="relative mt-3 grid grid-cols-4 gap-1" aria-label="Tiến trình đơn hàng">
    <span aria-hidden="true" class="absolute left-[12.5%] right-[12.5%] top-3 h-0.5 bg-stone-200" />
    <span
      aria-hidden="true"
      class="absolute left-[12.5%] top-3 h-0.5 bg-amber-600 transition-[width] duration-300"
      :style="{ width: `${progress * 0.75}%` }"
    />
    <li v-for="(step, index) in ORDER_FLOW" :key="step" class="flex flex-col items-center gap-1 text-center">
      <span
        class="relative z-10 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold"
        :class="isDone(index) ? 'bg-amber-700 text-white' : isActive(index) ? 'bg-white text-amber-800 ring-2 ring-amber-600' : 'bg-stone-100 text-stone-500'"
      >
        <NIcon v-if="isDone(index)" :size="12"><Checkmark /></NIcon>
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span
        class="text-[10px] leading-tight sm:text-xs"
        :class="isActive(index) ? 'font-semibold text-amber-800' : isDone(index) ? 'text-stone-700' : 'text-stone-500'"
      >
        {{ ORDER_STATUS_LABEL[step] }}
      </span>
    </li>
  </ol>
</template>
