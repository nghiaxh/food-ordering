<script setup lang="ts">
import type { Food } from '@/shared/types'
import FoodCard from '@/modules/menu/components/FoodCard.vue'

interface Props {
  foods: Food[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ seeAll: [] }>()
</script>

<template>
  <!-- Ưu đãi lấy từ discountPercent server đã tính; dùng chung thẻ món với lưới thực đơn. -->
  <section v-if="props.foods.length > 0">
    <div class="flex items-end justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <h2 class="text-base font-bold tracking-tight text-stone-900 sm:text-lg">Ưu đãi hôm nay</h2>
      </div>
      <button
        type="button"
        class="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-amber-800 hover:underline"
        @click="emit('seeAll')"
      >
        Xem tất cả
      </button>
    </div>

    <div class="-mx-1 mt-2 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div v-for="food in props.foods" :key="food.id" class="w-[240px] shrink-0 snap-start sm:w-[280px]">
        <FoodCard :food="food" />
      </div>
    </div>
  </section>
</template>
