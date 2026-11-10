<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  eyebrow?: string
}
const props = withDefaults(defineProps<Props>(), { align: 'center' })
</script>

<template>
  <div class="max-w-2xl mb-6" :class="props.align === 'center' ? 'text-center mx-auto' : 'text-left'">
    <span v-if="props.eyebrow" class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
      {{ props.eyebrow }}
    </span>
    <h2 class="mt-1.5 text-xl font-bold tracking-tight text-stone-900">{{ props.title }}</h2>
    <p v-if="props.subtitle" class="mt-2 text-sm leading-relaxed text-stone-500">{{ props.subtitle }}</p>
  </div>
</template>
