<script setup lang="ts">
import { NButton } from 'naive-ui'

defineProps<{ onBrowse: () => void; onAsk: () => void }>()
</script>

<template>
  <!-- Banner mo dau thuc don, trai het be ngang vung cuon. Chi hien khi chua co bo loc. -->
  <section class="relative isolate overflow-hidden">
    <img
      src="/images/hero.webp"
      alt=""
      loading="eager"
      fetchpriority="high"
      class="absolute inset-0 h-full w-full object-cover object-[58%_45%]"
    />
    <div class="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/10" />

    <div class="relative mx-auto flex h-[180px] max-w-[1600px] flex-col justify-center px-4 sm:h-[220px] sm:px-6 lg:h-[260px]">
      <h1 class="max-w-lg text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
        Hôm nay ăn gì?
      </h1>
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <NButton type="primary" size="medium" strong @click="onBrowse">Xem thực đơn</NButton>
        <button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-white/90 underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
          @click="onAsk"
        >
          Hỏi trợ lý AI
        </button>
      </div>
    </div>
  </section>
</template>
