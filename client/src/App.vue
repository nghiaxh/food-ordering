<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch } from 'vue'
import { NConfigProvider, NMessageProvider, NLoadingBarProvider, NDialogProvider } from 'naive-ui'
import viVN from 'naive-ui/es/locales/common/viVN'
import dateViVN from 'naive-ui/es/locales/date/viVN'
import ScrollManager from '@/components/ScrollManager.vue'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { syncChatOwner } from '@/user/chatbot/useChatConversation'

// Dong bo gio khi doi trang thai dang nhap: da dang nhap thi tai gio tu server,
// dang xuat thi xoa gio cua tai khoan khoi state. Khach vang lai khong co gio.
const auth = useAuthStore()
const cart = useCartStore()
watch(
  () => auth.user,
  (user) => {
    if (user) void cart.load()
    else cart.resetLocal()
  },
  { immediate: true },
)

// Cache chatbot gan chu so huu; dat o day vi widget chi mount o layout khach, con trang
// dang nhap/dang ky thi khong, nen doi tai khoan o do se khong tu don cache.
watch(
  () => auth.user?.id ?? null,
  (id) => syncChatOwner(id),
  { immediate: true },
)
</script>

<template>
  <NConfigProvider :locale="viVN" :date-locale="dateViVN" :theme-overrides="{ common: { primaryColor: '#ea580c', primaryColorHover: '#c2410c', primaryColorPressed: '#9a3412' } }">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <ScrollManager />
          <RouterView />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
