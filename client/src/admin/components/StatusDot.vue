<script setup lang="ts">
withDefaults(defineProps<{ color: string; label: string; muted?: boolean }>(), { muted: false })
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: color }" />
    <span class="text-sm" :class="muted ? 'text-stone-400' : 'text-stone-700'">{{ label }}</span>
  </span>
</template>
