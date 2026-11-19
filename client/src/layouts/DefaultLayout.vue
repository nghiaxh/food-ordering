<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch } from 'vue'
import HeaderGlobal from '@/components/HeaderGlobal.vue'
import CartDrawer from '@/user/cart/components/CartDrawer.vue'
import NotificationsDrawer from '@/user/notification/components/NotificationsDrawer.vue'
import ChatbotWidget from '@/user/chatbot/components/ChatbotWidget.vue'
import { useAuthStore } from '@/user/auth/store'
import { useUiStore } from '@/shared/stores/uiStore'

/**
 * Layout phia khach: thanh dieu huong. Gio/thong bao drawers va chatbot duoc cac
 * branch sau mount vao day - chua co component nen chua mount.
 */
const auth = useAuthStore()
const ui = useUiStore()

// Khach bam gio khi chua dang nhap duoc dua sang login kem co openCart;
// quay lai thi mo drawer gio luon. Co openCart bi xoa ngay de reload hay quay lai
// trang khong mo nham drawer khi user van dang nhap.
watch(
  () => auth.user,
  (user) => {
    const state = history.state as { openCart?: boolean } | null
    if (user && state?.openCart) ui.openDrawer('cart')
    if (state?.openCart) history.replaceState({ ...history.state, openCart: undefined }, '')
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
