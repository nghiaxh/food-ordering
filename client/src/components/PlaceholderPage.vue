<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ title: string }>()
</script>

<template>
  <div class="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
    <h1 class="text-2xl font-bold tracking-tight text-stone-900">{{ title }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-stone-500">Chức năng này đang được hoàn thiện và sẽ sớm ra mắt.</p>
    <RouterLink to="/" class="mt-6 rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-800">
      Về thực đơn
    </RouterLink>
  </div>
</template>
