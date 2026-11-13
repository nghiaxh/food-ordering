<script setup lang="ts">
import { NSkeleton } from 'naive-ui'

// Xuong bang dung chung: 5 cot gia, so dong tuy chinh.
withDefaults(defineProps<{ rows?: number }>(), { rows: 7 })
</script>

<template>
  <div class="space-y-3 p-3">
    <div class="hidden gap-3 md:flex">
      <NSkeleton v-for="i in 5" :key="i" height="10px" :width="`${30 + i * 10}%`" />
    </div>
    <div v-for="i in rows" :key="i" class="flex items-center gap-3">
      <NSkeleton circle :height="32" :width="32" />
      <NSkeleton height="10px" :width="`${80 - (i % 4) * 14}%`" />
      <NSkeleton height="10px" width="80px" />
      <NSkeleton height="20px" width="56px" />
    </div>
  </div>
</template>
