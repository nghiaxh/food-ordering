<script setup lang="ts">
// Xương bảng dùng chung: 5 cột giả, số dòng tuỳ chỉnh.
withDefaults(defineProps<{ rows?: number }>(), { rows: 7 })
</script>

<template>
  <div class="p-1">
    <div class="mb-6 hidden gap-4 md:flex">
      <span v-for="i in 5" :key="i" class="h-2.5 flex-1 animate-pulse rounded-full bg-stone-100" :style="{ width: `${30 + i * 10}%` }" />
    </div>
    <div v-for="i in rows" :key="i" class="flex items-center gap-4 border-b border-stone-100 py-2.5">
      <span class="h-8 w-8 flex-none animate-pulse rounded-lg bg-stone-100" />
      <span class="h-2.5 flex-1 animate-pulse rounded-full bg-stone-100" :style="{ width: `${80 - (i % 4) * 14}%` }" />
      <span class="h-2.5 w-20 flex-none animate-pulse rounded-full bg-stone-100" />
      <span class="h-5 w-14 flex-none animate-pulse rounded-full bg-stone-100" />
    </div>
  </div>
</template>
