<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { Food } from '@/shared/types'

import { formatVND } from '@/shared/utils/format'
import { foodChips, discountText } from '@/shared/utils/food-tags'

const MAX_CHIPS = 2
const MENU_SCROLL_KEY = 'menu-scroll'

const props = withDefaults(defineProps<{ food: Food; class?: string }>(), { class: '' })

const route = useRoute()
const router = useRouter()
const unit = () => props.food.discountedPrice ?? props.food.price

// Ca the mo trang chi tiet; luu vi tri cuon cua bang mon de khoi phuc khi quay lai.
const saveScroll = () => {
  const scroller = document.querySelector<HTMLElement>('.kiosk-scroll')
  if (scroller) sessionStorage.setItem(MENU_SCROLL_KEY, String(scroller.scrollTop))
}
const openDetail = () => {
  saveScroll()
  router.push({ path: `/foods/${props.food.id}`, state: { from: `${route.fullPath}` } })
}

const onCardClick = (event: MouseEvent) => {
  // Bo qua khi cu bam roi vao lien ket hoac nut ben trong the.
  if ((event.target as HTMLElement).closest('a, button')) return
  openDetail()
}

</script>

<template>
  <div
    class="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-md"
    :class="props.class"
    @click="onCardClick"
  >
    <div class="relative aspect-[16/10] overflow-hidden">
      <RouterLink :to="`/foods/${props.food.id}`" :state="{ from: route.fullPath }" class="block h-full w-full" :aria-label="`Xem chi tiết ${props.food.name}`" @click="saveScroll">
        <img
          :src="props.food.imageUrl ?? ''"
          :alt="props.food.name"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          :class="props.food.available ? '' : 'grayscale'"
        />
      </RouterLink>
      <div class="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
        <span v-if="!props.food.available" class="rounded-md bg-stone-900/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">Hết món</span>
        <span v-else-if="!!props.food.discountPercent" class="rounded-md bg-orange-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          -{{ props.food.discountPercent }}%
        </span>
      </div>
    </div>

    <div class="flex flex-1 flex-col p-2.5 sm:p-3">
      <RouterLink :to="`/foods/${props.food.id}`" :state="{ from: route.fullPath }" class="min-h-0" @click="saveScroll">
        <h3 class="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-stone-900 group-hover:text-orange-800 sm:text-sm">
          {{ props.food.name }}
        </h3>
      </RouterLink>

      <div class="mt-1 flex flex-wrap gap-1 sm:mt-1.5">
        <span
          v-for="chip in foodChips(props.food).slice(0, MAX_CHIPS)"
          :key="chip.label"
          class="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          :class="chip.className"
        >
          {{ chip.label }}
        </span>
      </div>

      <div class="mt-auto pt-2">
        <div class="flex flex-wrap items-baseline gap-1.5">
          <span class="text-base font-bold tabular-nums text-orange-800 sm:text-lg">{{ formatVND(unit()) }}</span>
          <span v-if="unit() < props.food.price" class="text-xs tabular-nums text-stone-500 line-through">
            {{ formatVND(props.food.price) }}
          </span>
        </div>
        <p class="mt-0.5 min-h-4 truncate text-[11px] font-medium text-emerald-700">
          {{ unit() < props.food.price ? discountText(props.food.discountLabel) ?? '' : '' }}
        </p>
      </div>
    </div>
  </div>
</template>
