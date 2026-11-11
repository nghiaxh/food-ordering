<script setup lang="ts">
import { ref, computed } from 'vue'
import { Star, StarOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

interface Props {
  value: number
  onChange?: (value: number) => void
  size?: number
  disabled?: boolean
  class?: string
}
const props = withDefaults(defineProps<Props>(), { size: 16, disabled: false, class: '' })
const hovered = ref(0)
const interactive = computed(() => !!props.onChange && !props.disabled)
const active = computed(() => (hovered.value > 0 ? hovered.value : Math.max(0, Math.min(5, props.value))))
</script>

<template>
  <!-- Che do chi doc khong dung nut: tranh nut long trong nut khi dat canh lien ket hoac tieu de bam duoc. -->
  <span
    v-if="!interactive"
    role="img"
    :aria-label="`${active} trên 5 sao`"
    class="inline-flex items-center gap-0.5"
    :class="props.class"
  >
    <span v-for="star in [1, 2, 3, 4, 5]" :key="star" aria-hidden="true" class="leading-none">
      <NIcon :size="props.size" :class="star <= active ? 'text-amber-500' : 'text-stone-300'">
        <Star v-if="star <= active" /><StarOutline v-else />
      </NIcon>
    </span>
  </span>

  <div v-else role="radiogroup" aria-label="Đánh giá sao" class="inline-flex items-center gap-0.5" :class="props.class">
    <button
      v-for="star in [1, 2, 3, 4, 5]"
      :key="star"
      type="button"
      role="radio"
      :aria-label="`${star} trên 5 sao`"
      :aria-checked="props.value === star"
      class="cursor-pointer leading-none"
      @mouseenter="hovered = star"
      @mouseleave="hovered = 0"
      @click="props.onChange?.(star)"
    >
      <NIcon :size="props.size" :class="star <= active ? 'text-amber-500' : 'text-stone-300'">
        <Star v-if="star <= active" /><StarOutline v-else />
      </NIcon>
    </button>
  </div>
</template>
