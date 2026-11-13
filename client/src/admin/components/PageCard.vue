<script setup lang="ts">
// Card nen trang dung chung cho admin; vien mong va bo do bo giup giao dien gon nhe.
defineProps<{ class?: string }>()
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-stone-200 bg-white" :class="$props.class">
    <slot />
  </div>
</template>
