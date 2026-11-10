<script setup lang="ts">
import { RouterLink } from 'vue-router'

withDefaults(defineProps<{ class?: string }>(), { class: '' })
</script>

<template>
  <RouterLink
    to="/"
    aria-label="FoodOrdering, về trang chủ"
    class="flex shrink-0 cursor-pointer items-center gap-2"
    :class="$props.class"
  >
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-stone-50 ring-1 ring-stone-100">
      <span aria-hidden="true" class="text-xl leading-none">🍜</span>
    </span>
    <span class="hidden text-[15px] font-bold tracking-tight text-stone-900 sm:inline">FoodOrdering</span>
  </RouterLink>
</template>
