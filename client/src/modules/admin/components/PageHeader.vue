<script setup lang="ts">
// Header chuan cho trang admin: tieu de trai, cum hanh dong phai.
defineProps<{ title: string }>()
</script>

<template>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-2xl font-bold tracking-tight text-stone-900">{{ title }}</h2>
    <div v-if="$slots.extra" class="flex shrink-0 items-center gap-2"><slot name="extra" /></div>
  </div>
</template>
