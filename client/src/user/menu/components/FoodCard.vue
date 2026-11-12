<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NTooltip, NIcon } from 'naive-ui'
import { Add } from '@vicons/ionicons5'
import type { Food } from '@/shared/types'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { formatVND } from '@/shared/utils/format'
import { foodChips, discountText } from '@/shared/utils/food-tags'
import { message } from '@/shared/api/message'

/** Chi hien 2 nhan dau: the mon phai con cho cho gia va nut, them nhan chi lam loang. */
const MAX_CHIPS = 2
const MENU_SCROLL_KEY = 'menu-scroll'

const props = withDefaults(defineProps<{ food: Food; class?: string }>(), { class: '' })

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()
const router = useRouter()
// Chan bam lap trong luc request them mon dang bay, tranh cong don hai lan.
const adding = ref(false)
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

const handleAdd = async () => {
  if (!props.food.available || adding.value) return
  if (!auth.user) {
    message.info('Đăng nhập để thêm món vào giỏ')
    router.push({ path: '/login', state: { from: { pathname: route.path, search: route.fullPath.slice(route.path.length) } } })
    return
  }
  adding.value = true
  try {
    const ok = await cart.add(props.food)
    if (ok) message.success(`Đã thêm ${props.food.name} vào giỏ`)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div
    class="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-lg"
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
        <span v-if="!props.food.available" class="rounded-full bg-stone-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">Hết món</span>
        <span v-else-if="!!props.food.discountPercent" class="rounded-full bg-amber-700 px-2 py-0.5 text-[11px] font-semibold text-white">
          -{{ props.food.discountPercent }}%
        </span>
      </div>
      <NTooltip trigger="hover" placement="bottom">
        <template #trigger>
          <button
            type="button"
            :aria-label="props.food.available ? `Thêm ${props.food.name} vào giỏ` : `${props.food.name} tạm hết`"
            :disabled="!props.food.available || adding"
            class="absolute right-2 top-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-amber-700 leading-none text-white opacity-0 shadow-sm transition hover:bg-amber-800 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 disabled:cursor-not-allowed disabled:bg-stone-400"
            @click.stop="handleAdd"
          >
            <NIcon :size="16"><Add /></NIcon>
          </button>
        </template>
        {{ props.food.available ? `Thêm ${props.food.name} vào giỏ` : `${props.food.name} tạm hết` }}
      </NTooltip>
    </div>

    <div class="flex flex-1 flex-col p-2.5 sm:p-3">
      <RouterLink :to="`/foods/${props.food.id}`" :state="{ from: route.fullPath }" class="min-h-0" @click="saveScroll">
        <h3 class="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-stone-900 group-hover:text-amber-800 sm:text-sm">
          {{ props.food.name }}
        </h3>
      </RouterLink>

      <div class="mt-1 flex flex-wrap gap-1 sm:mt-1.5">
        <span
          v-for="chip in foodChips(props.food).slice(0, MAX_CHIPS)"
          :key="chip.label"
          class="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="chip.className"
        >
          {{ chip.label }}
        </span>
      </div>

      <div class="mt-auto pt-2">
        <div class="flex flex-wrap items-baseline gap-1.5">
          <span class="text-base font-bold tabular-nums text-amber-800 sm:text-lg">{{ formatVND(unit()) }}</span>
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
