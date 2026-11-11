<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { watch } from 'vue'
import HeaderGlobal from '@/components/HeaderGlobal.vue'
import CartDrawer from '@/modules/cart/components/CartDrawer.vue'
import NotificationsDrawer from '@/modules/notification/components/NotificationsDrawer.vue'
import ChatbotWidget from '@/modules/chatbot/components/ChatbotWidget.vue'
import { useAuthStore } from '@/modules/auth/store'
import { useUiStore } from '@/shared/stores/uiStore'

/**
 * Layout phia khach: thanh dieu huong. Gio/thong bao drawers va chatbot duoc cac
 * branch sau mount vao day — chua co component nen chua mount.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// Khach bam gio khi chua dang nhap duoc dua sang login kem co openCart;
// quay lai thi mo drawer gio luon.
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
  <CartDrawer />
  <NotificationsDrawer />
  <ChatbotWidget />
</template>
