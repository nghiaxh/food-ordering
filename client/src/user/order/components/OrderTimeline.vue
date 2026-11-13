<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutline, Checkmark } from '@vicons/ionicons5'
import type { OrderStatus } from '@/shared/types'
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '@/shared/utils/orders'

/**
 * Tien trinh don tu ve: chi danh dau buoc hien tai, khong bia moc gio; don da huy thi
 * khong ve day buoc. Duong noi chay tu tam buoc dau toi tam buoc cuoi.
 * Tinh o script (isCompleted boolean) de template khong bi narrow type lan lon.
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
  <p v-if="props.status === 'CANCELLED'" class="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
    <NIcon :size="12"><CloseOutline /></NIcon>
    Đơn đã hủy
  </p>

  <ol v-else class="relative mt-2 grid grid-cols-4 gap-1" aria-label="Tiến trình đơn hàng">
    <span aria-hidden="true" class="absolute left-[12.5%] right-[12.5%] top-2.5 h-0.5 bg-stone-200" />
    <span
      aria-hidden="true"
      class="absolute left-[12.5%] top-2.5 h-0.5 bg-orange-500 transition-[width] duration-300"
      :style="{ width: `${progress * 0.75}%` }"
    />
    <li v-for="(step, index) in ORDER_FLOW" :key="step" class="flex flex-col items-center gap-1 text-center">
      <span
        class="relative z-10 grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold sm:text-[10px]"
        :class="isDone(index) ? 'bg-orange-500 text-white' : isActive(index) ? 'bg-white text-orange-600 ring-2 ring-orange-500' : 'bg-stone-100 text-stone-400'"
      >
        <NIcon v-if="isDone(index)" :size="10"><Checkmark /></NIcon>
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span
        class="text-[10px] leading-tight sm:text-[11px]"
        :class="isActive(index) ? 'font-semibold text-orange-600' : isDone(index) ? 'text-stone-600' : 'text-stone-400'"
      >
        {{ ORDER_STATUS_LABEL[step] }}
      </span>
    </li>
  </ol>
</template>
