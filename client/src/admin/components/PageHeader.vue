<script setup lang="ts">
// Header chuan cho trang admin: tieu de trai, cum hanh dong phai.
// Tieu de giu the h2 de trang co role heading cho trinh doc va cho e2e tim bang tieu de.
defineProps<{ title: string }>()
</script>

<template>
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-lg font-semibold tracking-tight text-stone-900">{{ title }}</h2>
    <div v-if="$slots.extra" class="flex shrink-0 items-center gap-2"><slot name="extra" /></div>
  </div>
</template>
