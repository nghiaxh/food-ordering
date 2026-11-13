<script setup lang="ts">
import { computed, ref, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NBadge, NButton, NAvatar, NConfigProvider, NDrawer, NDrawerContent, NDropdown, NIcon, type DropdownOption } from 'naive-ui'
import {
  HomeOutline,
  ReceiptOutline,
  PeopleOutline,
  PricetagOutline,
  GridOutline,
  FlameOutline,
  ChatbubbleOutline,
  DocumentTextOutline,
  MenuOutline,
  NotificationsOutline,
  PersonOutline,
  LogOutOutline,
} from '@vicons/ionicons5'
import BrandMark from '@/components/BrandMark.vue'
import NotificationsDrawer from '@/user/notification/components/NotificationsDrawer.vue'
import { adminGetOrders } from '@/admin/order/api'
import { useAuthStore } from '@/user/auth/store'
import { useNotificationStore } from '@/user/notification/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { ADMIN_THEME_OVERRIDES } from '@/shared/theme'

interface NavItem {
  label: string
  to: string
  icon: unknown
}

// Nhom theo viec quan lam hang ngay; thu tu co dinh theo quy trinh ban hang.
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Bán hàng', items: [
    { label: 'Tổng quan', to: '/admin/dashboard', icon: HomeOutline },
    { label: 'Đơn hàng', to: '/admin/orders', icon: ReceiptOutline },
    { label: 'Khách hàng', to: '/admin/customers', icon: PeopleOutline },
  ] },
  { title: 'Thực đơn', items: [
    { label: 'Món ăn', to: '/admin/foods', icon: PricetagOutline },
    { label: 'Danh mục', to: '/admin/categories', icon: GridOutline },
  ] },
  { title: 'Marketing', items: [
    { label: 'Khuyến mãi', to: '/admin/promotions', icon: FlameOutline },
  ] },
  { title: 'Hệ thống', items: [
    { label: 'Chatbot', to: '/admin/chatbot', icon: ChatbubbleOutline },
    { label: 'Báo cáo', to: '/admin/reports', icon: DocumentTextOutline },
  ] },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationStore()
const ui = useUiStore()
const user = computed(() => auth.user)

const drawerOpen = ref(false)
const pendingCount = ref(0)
const unread = computed(() => notifications.unread)

// So don cho xac nhan tren muc "Don hang". nap lai moi lan vao khu quan tri.
const loadPending = async () => {
  try {
    const orders = await adminGetOrders()
    pendingCount.value = orders.filter((o) => o.status === 'PENDING').length
  } catch {
    pendingCount.value = 0
  }
}
watch(() => route.path, () => { void loadPending() }, { immediate: true })
watch(
  () => auth.user,
  (u) => {
    if (u) void notifications.load()
    else notifications.reset()
  },
  { immediate: true },
)

const closeDrawer = () => { drawerOpen.value = false }
const isActive = (item: NavItem) => route.path === item.to

const menuOptions: DropdownOption[] = [
  { key: 'account', label: 'Tài khoản', icon: () => h(NIcon, { size: 16 }, () => h(PersonOutline)) },
  { key: 'logout', label: 'Đăng xuất', icon: () => h(NIcon, { size: 16 }, () => h(LogOutOutline)) },
]
const onSelectMenu = (key: string) => {
  if (key === 'account') router.push('/profile')
  else {
    auth.logout()
    router.push('/')
  }
}
</script>

<template>
  <!-- Khu quan tri dung mau orange rieng; trang khach giu nguyen mau goc cua app. -->
  <NConfigProvider :theme-overrides="ADMIN_THEME_OVERRIDES">
    <div class="flex min-h-dvh flex-col bg-stone-50">
      <header class="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div class="flex h-12 items-center gap-2 px-3 sm:px-4">
          <NButton text class="lg:hidden" aria-label="Mở menu quản trị" @click="drawerOpen = true">
            <template #icon><NIcon :size="20"><MenuOutline /></NIcon></template>
          </NButton>
          <BrandMark />
          <div class="ml-auto flex items-center gap-1">
            <NButton
              quaternary
              circle
              size="small"
              :aria-label="unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'"
              @click="ui.openDrawer('notifications')"
            >
              <NBadge :value="unread" :show="unread > 0" dot color="#c2410c">
                <NIcon :size="18"><NotificationsOutline /></NIcon>
              </NBadge>
            </NButton>
            <NDropdown trigger="click" placement="bottom-end" :options="menuOptions" @select="onSelectMenu">
              <NButton quaternary circle size="small" aria-label="Menu tài khoản">
                <NAvatar round :size="26" color="#c2410c">
                  <span class="text-xs font-semibold text-white">{{ user?.fullName?.charAt(0).toUpperCase() }}</span>
                </NAvatar>
              </NButton>
            </NDropdown>
          </div>
        </div>
      </header>

      <div class="flex w-full flex-1">
        <aside class="hidden w-52 shrink-0 border-r border-stone-200 bg-white lg:block">
          <nav class="sticky top-12 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto p-3" aria-label="Điều hướng quản trị">
            <div v-for="group in NAV_GROUPS" :key="group.title">
              <p class="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">{{ group.title }}</p>
              <RouterLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :aria-current="isActive(item) ? 'page' : undefined"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition"
                :class="isActive(item) ? 'bg-orange-50 font-medium text-orange-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'"
              >
                <NIcon :size="16"><component :is="item.icon" /></NIcon>
                <span class="flex-1">{{ item.label }}</span>
                <NBadge v-if="item.to === '/admin/orders' && pendingCount > 0" :value="pendingCount" :max="99" color="#c2410c" />
              </RouterLink>
            </div>
          </nav>
        </aside>
        <main class="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5"><RouterView /></main>
      </div>

      <!-- NDrawer khong render slot header/footer; phai bo NDrawerContent de co tieu de va nut dong. -->
      <NDrawer :show="drawerOpen" placement="left" :width="260" :auto-focus="false" @update:show="(v: boolean) => !v && closeDrawer()">
        <NDrawerContent closable header-class="px-3 py-2" body-content-class="p-0">
          <template #header>
            <span class="flex items-center gap-2" @click="closeDrawer"><BrandMark /></span>
          </template>
          <nav class="space-y-4 px-3 pb-3" aria-label="Điều hướng quản trị">
            <div v-for="group in NAV_GROUPS" :key="group.title">
              <p class="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">{{ group.title }}</p>
              <RouterLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :aria-current="isActive(item) ? 'page' : undefined"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition"
                :class="isActive(item) ? 'bg-orange-50 font-medium text-orange-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'"
                @click="closeDrawer"
              >
                <NIcon :size="16"><component :is="item.icon" /></NIcon>
                <span class="flex-1">{{ item.label }}</span>
                <NBadge v-if="item.to === '/admin/orders' && pendingCount > 0" :value="pendingCount" :max="99" color="#c2410c" />
              </RouterLink>
            </div>
          </nav>
        </NDrawerContent>
      </NDrawer>

      <NotificationsDrawer />
    </div>
  </NConfigProvider>
</template>
