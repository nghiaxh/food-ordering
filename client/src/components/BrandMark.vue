<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { NIcon } from 'naive-ui'
import { HomeOutline } from '@vicons/ionicons5'

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
      <NIcon :size="20" aria-hidden="true"><HomeOutline /></NIcon>
    </span>
  </RouterLink>
</template>
