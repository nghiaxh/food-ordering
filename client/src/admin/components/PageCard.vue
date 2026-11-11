<script setup lang="ts">
// Card nen trang dung chung cho admin.
defineProps<{ class?: string }>()
</script>

<template>
  <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70" :class="$props.class">
    <slot />
  </div>
</template>
