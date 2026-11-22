<script setup lang="ts">
defineProps<{ class?: string }>()
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-stone-200 bg-white" :class="$props.class">
    <slot />
  </div>
</template>
