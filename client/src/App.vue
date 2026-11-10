<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch } from 'vue'
import { NConfigProvider, NMessageProvider, NLoadingBarProvider } from 'naive-ui'
import viVN from 'naive-ui/es/locales/common/viVN'
import dateViVN from 'naive-ui/es/locales/date/viVN'
import ScrollManager from '@/components/ScrollManager.vue'
import { useAuthStore } from '@/modules/auth/store'
import { useCartStore } from '@/modules/cart/store'

// Đồng bộ giỏ khi đổi trạng thái đăng nhập: đã đăng nhập thì tải giỏ từ server,
// đăng xuất thì xoá giỏ của tài khoản khỏi state. Khách vãng lai không có giỏ.
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
        <ScrollManager />
        <RouterView />
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
