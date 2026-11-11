<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { GridOutline } from '@vicons/ionicons5'
import type { Category } from '@/shared/types'

interface Props {
  categories: Category[]
  activeId?: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ pick: [id?: number] }>()

const chip = (active: boolean) =>
  `inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3.5 text-[13px] font-medium transition ${
    active ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
  }`
</script>

<template>
  <!-- Dai danh muc chip co anh tron; cuon ngang tren mobile, cung ngon ngu voi hang chip bo loc. -->
  <div v-if="props.categories.length > 0" class="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <button type="button" :class="chip(props.activeId === undefined)" @click="emit('pick', undefined)">
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        :class="props.activeId === undefined ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-500'"
      >
        <NIcon :size="14"><GridOutline /></NIcon>
      </span>
      Tất cả
    </button>

    <button
      v-for="category in props.categories"
      :key="category.id"
      type="button"
      :title="category.description || category.name"
      :aria-pressed="props.activeId === category.id"
      :class="chip(props.activeId === category.id)"
      @click="emit('pick', category.id)"
    >
      <img :src="category.imageUrl ?? ''" alt="" loading="lazy" class="h-8 w-8 rounded-full object-cover" />
      {{ category.name }}
    </button>
  </div>
</template>
