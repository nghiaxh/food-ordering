<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Props {
  title: string
  maxWidth?: string
}
const props = withDefaults(defineProps<Props>(), { maxWidth: 'max-w-[400px]' })
const router = useRouter()
</script>

<template>
  <div
    class="auth-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4"
    :style="{
      backgroundImage: 'url(/images/hero.webp)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#1c1917',
    }"
  >
    <div class="absolute inset-0 bg-gradient-to-b from-stone-950/45 via-stone-950/65 to-stone-950/80 backdrop-blur-[2px]" aria-hidden="true" />

    <button
      type="button"
      class="absolute left-4 top-4 z-20 cursor-pointer rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm backdrop-blur transition hover:bg-white"
      @click="router.push('/')"
    >
      Trang chủ
    </button>

    <div :class="`relative z-10 w-full ${props.maxWidth} rounded-3xl bg-white p-6 shadow-2xl shadow-stone-950/40 ring-1 ring-stone-950/5 sm:p-8`">
      <h1 class="text-center text-2xl font-extrabold tracking-tight text-stone-900">{{ props.title }}</h1>
      <div class="mt-6"><slot /></div>
    </div>
  </div>
</template>
