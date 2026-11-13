<script setup lang="ts">
import { NEmpty, NIcon } from 'naive-ui'
import { FileTrayFullOutline } from '@vicons/ionicons5'

withDefaults(defineProps<{ title: string; hint?: string }>(), { hint: '' })
</script>

<template>
  <NEmpty size="small" class="py-8">
    <template #icon>
      <!-- NIcon lay mau theo currentColor nen mau xam dat o span bao ngoai. -->
      <span class="text-stone-300"><NIcon :size="24"><FileTrayFullOutline /></NIcon></span>
    </template>
    <template #default>
      <p class="text-sm font-medium text-stone-700">{{ title }}</p>
      <p v-if="hint" class="mt-1 text-xs text-stone-400">{{ hint }}</p>
    </template>
  </NEmpty>
</template>
