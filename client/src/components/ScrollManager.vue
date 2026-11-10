<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'

const HEADER_OFFSET = 64
const route = useRoute()

const scrollToHash = (hash: string) => {
  const id = decodeURIComponent(hash.slice(1))
  if (!id) return
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  let remaining = 20
  const attempt = () => {
    const el = document.getElementById(id)
    if (el) {
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET)
      window.scrollTo({ top, behavior })
      return
    }
    if (remaining-- > 0) window.setTimeout(attempt, 100)
  }
  attempt()
}

// Mỗi lần đổi path thì đưa trang về đầu; nếu đổi hash thì cuộn tới đúng neo.
watch(
  () => [route.path, route.hash] as const,
  ([_path, hash]) => {
    if (hash) scrollToHash(hash)
    else window.scrollTo({ top: 0, behavior: 'auto' })
  },
  { immediate: true },
)
</script>

<template><span hidden /></template>
