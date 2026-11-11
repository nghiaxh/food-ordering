<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { FileTrayFullOutline } from '@vicons/ionicons5'

withDefaults(defineProps<{ title: string; hint?: string }>(), { hint: '' })
</script>

<template>
  <div class="flex flex-col items-center px-6 py-14 text-center">
    <span class="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-stone-50 text-stone-300">
      <NIcon :size="26"><FileTrayFullOutline /></NIcon>
    </span>
    <p class="font-medium text-stone-700">{{ title }}</p>
    <p v-if="hint" class="mt-1 max-w-sm text-sm text-stone-400">{{ hint }}</p>
  </div>
</template>
