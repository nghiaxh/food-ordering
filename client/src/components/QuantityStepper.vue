<script setup lang="ts">
import { RemoveOutline, Add } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

interface Props {
  value: number
  min?: number
  max?: number
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}
const props = withDefaults(defineProps<Props>(), {
  min: 1,
  max: 99,
  disabled: false,
  size: 'md',
  label: 'Số lượng',
})
const emit = defineEmits<{ 'update:value': [value: number] }>()

// Bo chon so luong dung chung cho gio, checkout va trang chi tiet mon. Khong dung
// NInputNumber vi o nhap so moi nguoi dung go so am hoac so qua lon.
const box = () => (props.size === 'sm' ? 'h-9 w-9' : 'h-11 w-11')
const text = () => (props.size === 'sm' ? 'w-8 text-sm' : 'w-10 text-base')
const iconSize = () => (props.size === 'sm' ? 10 : 12)
const step = (delta: number) => {
  const next = Math.min(props.max, Math.max(props.min, props.value + delta))
  emit('update:value', next)
}
</script>

<template>
  <div class="flex shrink-0 items-center overflow-hidden rounded-full ring-1 ring-stone-200" role="group" :aria-label="props.label">
    <button
      type="button"
      aria-label="Giảm số lượng"
      :disabled="props.disabled || props.value <= props.min"
      class="flex cursor-pointer items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      :class="[box(), 'rounded-l-full']"
      @click="step(-1)"
    >
      <NIcon :size="iconSize()"><RemoveOutline /></NIcon>
    </button>
    <span class="text-center font-semibold tabular-nums text-stone-900" :class="text()" aria-live="polite">
      {{ props.value }}
    </span>
    <button
      type="button"
      aria-label="Tăng số lượng"
      :disabled="props.disabled || props.value >= props.max"
      class="flex cursor-pointer items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      :class="[box(), 'rounded-r-full']"
      @click="step(1)"
    >
      <NIcon :size="iconSize()"><Add /></NIcon>
    </button>
  </div>
</template>
