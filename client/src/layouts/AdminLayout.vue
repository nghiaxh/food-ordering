<script setup lang="ts">
import { computed, ref, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NBadge, NButton, NAvatar, NDrawer, NDropdown, NIcon, type DropdownOption } from 'naive-ui'
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
import NotificationsDrawer from '@/modules/notification/components/NotificationsDrawer.vue'
import { adminGetOrders } from '@/modules/admin/api'
import { useAuthStore } from '@/modules/auth/store'
import { useNotificationStore } from '@/modules/notification/store'
import { useUiStore } from '@/shared/stores/uiStore'

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

// So don cho xac nhan tren muc "Don hang" — nap lai moi lan vao khu quan tri.
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
  <div class="flex min-h-dvh flex-col bg-stone-50">
    <header class="sticky top-0 z-50 border-b border-stone-200/70 bg-white">
      <div class="flex h-14 items-center gap-3 px-4 sm:px-6">
        <NButton text aria-label="Mở menu quản trị" class="lg:hidden" @click="drawerOpen = true">
          <template #icon><NIcon :size="22"><MenuOutline /></NIcon></template>
        </NButton>
        <div class="ml-auto flex items-center gap-1.5">
          <button type="button" :aria-label="unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'" class="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full text-stone-600 transition hover:bg-amber-50 hover:text-amber-800" @click="ui.openDrawer('notifications')">
            <NBadge :value="unread" :show="unread > 0" dot color="#b45309">
              <NIcon :size="20"><NotificationsOutline /></NIcon>
            </NBadge>
          </button>
          <NDropdown trigger="click" placement="bottom-end" :options="menuOptions" @select="onSelectMenu">
            <button type="button" aria-label="Menu tài khoản" class="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition hover:bg-stone-50">
              <NAvatar :size="30" color="#b45309" class="text-sm font-semibold">
                {{ user?.fullName?.charAt(0).toUpperCase() }}
              </NAvatar>
            </button>
          </NDropdown>
        </div>
      </div>
    </header>

    <div class="flex w-full flex-1 gap-6 px-4 py-6 sm:px-6">
      <aside class="hidden w-56 shrink-0 lg:block">
        <div class="sticky top-20 rounded-xl border border-stone-200/70 bg-white p-2.5">
          <nav class="space-y-3" aria-label="Điều hướng quản trị">
            <div v-for="group in NAV_GROUPS" :key="group.title">
              <p class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{{ group.title }}</p>
              <RouterLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :aria-current="isActive(item) ? 'page' : undefined"
                class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
                :class="isActive(item) ? 'bg-amber-50 font-semibold text-amber-800' : 'font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
              >
                <NIcon :size="16"><component :is="item.icon" /></NIcon>
                <span class="flex-1">{{ item.label }}</span>
                <NBadge v-if="item.to === '/admin/orders' && pendingCount > 0" :value="pendingCount" :max="99" color="#b45309" />
              </RouterLink>
            </div>
          </nav>
        </div>
      </aside>
      <main class="min-w-0 flex-1"><RouterView /></main>
    </div>

    <NDrawer :show="drawerOpen" placement="left" :width="280" :auto-focus="false" @update:show="(v: boolean) => !v && closeDrawer()">
      <template #header>
        <span class="flex items-center gap-2"><BrandMark /></span>
      </template>
      <nav class="space-y-3" aria-label="Điều hướng quản trị">
        <div v-for="group in NAV_GROUPS" :key="group.title">
          <p class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
            :class="isActive(item) ? 'bg-amber-50 font-semibold text-amber-800' : 'font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
            @click="closeDrawer"
          >
            <NIcon :size="16"><component :is="item.icon" /></NIcon>
            <span class="flex-1">{{ item.label }}</span>
            <NBadge v-if="item.to === '/admin/orders' && pendingCount > 0" :value="pendingCount" :max="99" color="#b45309" />
          </RouterLink>
        </div>
      </nav>
    </NDrawer>

    <NotificationsDrawer />
  </div>
</template>
