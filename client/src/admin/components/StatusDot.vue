<script setup lang="ts">
import { STATUS_TONE_CLASS, type StatusTone } from '@/admin/components/shared'

// Cham trang thai: cham mau + chu. Mau lay theo class Tailwind nen khong co hex noi tuy.
withDefaults(defineProps<{ tone: StatusTone; label: string; muted?: boolean }>(), { muted: false })
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span class="h-2 w-2 shrink-0 rounded-full" :class="STATUS_TONE_CLASS[tone]" />
    <span class="text-sm" :class="muted ? 'text-stone-400' : 'text-stone-700'">{{ label }}</span>
  </span>
</template>
