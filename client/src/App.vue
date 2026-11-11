<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch } from 'vue'
import { NConfigProvider, NMessageProvider, NLoadingBarProvider, NDialogProvider } from 'naive-ui'
import viVN from 'naive-ui/es/locales/common/viVN'
import dateViVN from 'naive-ui/es/locales/date/viVN'
import ScrollManager from '@/components/ScrollManager.vue'
import { useAuthStore } from '@/modules/auth/store'
import { useCartStore } from '@/modules/cart/store'

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
</script>

<template>
  <NConfigProvider :locale="viVN" :date-locale="dateViVN" :theme-overrides="{ common: { primaryColor: '#b45309', primaryColorHover: '#92400e', primaryColorPressed: '#78350f' } }">
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
