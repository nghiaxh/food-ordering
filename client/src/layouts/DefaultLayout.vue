<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { watch } from 'vue'
import HeaderGlobal from '@/components/HeaderGlobal.vue'
import { useAuthStore } from '@/modules/auth/store'
import { useUiStore } from '@/shared/stores/uiStore'

/**
 * Layout phía khách: thanh điều hướng. Giỏ/thông báo drawers và chatbot được các
 * branch sau mount vào đây — chưa có component nên chưa mount.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// Khách bấm giỏ khi chưa đăng nhập được đưa sang login kèm cờ openCart;
// quay lại thì mở drawer giỏ luôn.
watch(
  () => auth.user,
  (user) => {
    const state = history.state as { openCart?: boolean } | null
    if (user && state?.openCart) {
      ui.openDrawer('cart')
      router.replace({ path: route.path, query: route.query })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-stone-50">
    <HeaderGlobal />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
