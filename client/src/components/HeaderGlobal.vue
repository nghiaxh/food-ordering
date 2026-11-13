<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAvatar, NBadge, NButton, NDropdown, NIcon, NInput, NTooltip, type DropdownOption } from 'naive-ui'
import {
  NotificationsOutline,
  CartOutline,
  GridOutline,
  ReceiptOutline,
  PersonOutline,
  LogOutOutline,
  SearchOutline,
} from '@vicons/ionicons5'
import BrandMark from '@/components/BrandMark.vue'
import useMediaQuery from '@/composables/useMediaQuery'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { useNotificationStore } from '@/user/notification/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { message } from '@/shared/api/message'

/**
 * Thanh dieu huong mot hang o moi kich thuoc: logo, o tim kiem, don hang, gio, tai khoan.
 * Tu `lg` thong bao va don hang co nut rieng; duoi `lg` chung nam trong menu tai khoan.
 */
const route = useRoute()
const router = useRouter()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const auth = useAuthStore()
const cart = useCartStore()
const notifications = useNotificationStore()
const ui = useUiStore()
const user = computed(() => auth.user)
const isAdmin = computed(() => user.value?.role === 'ADMIN')

// O tim kiem ghi thang vao URL de trang thuc don doc duoc va chia se duoc duong dan da loc.
const keyword = computed(() => (Array.isArray(route.query.keyword) ? route.query.keyword[0] : route.query.keyword) ?? '')
const draft = ref(keyword.value)
watch(keyword, (value) => {
  draft.value = value
})

// Nap lai so chua doc khi doi tai khoan hoac quay ve tu trang don hang.
onMounted(() => {
  if (user.value) void notifications.load()
})
watch(user, (value) => {
  if (value) void notifications.load()
  else notifications.reset()
})
watch(
  () => route.path,
  () => {
    if (user.value) void notifications.load()
  },
)

/** Ghi tu khoa vao URL: o trang chu de len bo loc hien co, o trang khac thi ve "/" kem tu khoa. */
const commitSearch = (value: string) => {
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(route.query)) {
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v != null) params.set(key, String(v))
  }
  const trimmed = value.trim()
  if (trimmed) params.set('keyword', trimmed)
  else params.delete('keyword')
  if (route.path === '/') {
    router.replace({ query: Object.fromEntries(params) })
  } else {
    router.push(params.size > 0 ? `/?${params.toString()}` : '/')
  }
}

// Debounce 300ms; input trong van ghi qua commitSearch de xoa tu khoa.
watch(draft, (value, _oldValue, onCleanup) => {
  if (value === keyword.value) return
  const timer = window.setTimeout(() => commitSearch(value), 300)
  onCleanup(() => window.clearTimeout(timer))
})

/** Gio can dang nhap; khach vang lai duoc dua sang dang nhap roi mo lai gio. */
const openCart = () => {
  if (!user.value) {
    message.info('Đăng nhập để xem giỏ hàng')
    router.push({ path: '/login', state: { from: { pathname: route.path, search: route.fullPath.slice(route.path.length) }, openCart: true } })
    return
  }
  ui.openDrawer('cart')
}

const onSelectMenu = (key: string) => {
  if (key === 'logout') {
    auth.logout()
    router.push('/')
    return
  }
  if (key === 'notifications') {
    ui.openDrawer('notifications')
    return
  }
  if (key === 'admin') {
    router.push('/admin')
    return
  }
  router.push(key === 'orders' ? '/orders' : '/profile')
}

const menuOptions = computed<DropdownOption[]>(() => [
  ...(!isDesktop.value
    ? [
        {
          key: 'notifications',
          label: () =>
            h('span', { class: 'flex items-center gap-2' }, [
              'Thông báo',
              notifications.unread > 0
                ? h(
                    'span',
                    { class: 'rounded-md bg-orange-100 px-1 py-0.5 text-[10px] font-semibold text-orange-800' },
                    String(notifications.unread),
                  )
                : null,
            ]),
          icon: () => h(NIcon, { size: 16 }, () => h(NotificationsOutline)),
        },
        isAdmin.value
          ? { key: 'admin', label: 'Trang quản trị', icon: () => h(NIcon, { size: 16 }, () => h(GridOutline)) }
          : { key: 'orders', label: 'Đơn hàng của tôi', icon: () => h(NIcon, { size: 16 }, () => h(ReceiptOutline)) },
      ]
    : []),
  ...(isAdmin.value && isDesktop.value
    ? [{ key: 'admin', label: 'Trang quản trị', icon: () => h(NIcon, { size: 16 }, () => h(GridOutline)) }]
    : []),
  { key: 'account', label: 'Tài khoản', icon: () => h(NIcon, { size: 16 }, () => h(PersonOutline)) },
  { key: 'logout', label: 'Đăng xuất', icon: () => h(NIcon, { size: 16 }, () => h(LogOutOutline)) },
])

const iconButtonClass =
  'relative grid h-10 w-10 cursor-pointer place-items-center rounded-full text-stone-600 transition hover:bg-orange-50 hover:text-orange-800 focus-visible:outline-2'
</script>

<template>
  <header class="sticky top-0 z-50 h-[var(--header-h)] border-b border-stone-200/70 bg-white/95 backdrop-blur-xl">
    <div class="mx-auto flex h-full max-w-[1600px] items-center gap-1.5 px-3 sm:gap-3 sm:px-5">
      <BrandMark />

      <NInput
        v-model:value="draft"
        clearable
        placeholder="Tìm món..."
        aria-label="Tìm món"
        class="min-w-0 flex-1"
        @keyup.enter="commitSearch(draft)"
      >
        <template #prefix>
          <NIcon :size="18" class="text-stone-400"><SearchOutline /></NIcon>
        </template>
      </NInput>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NTooltip v-if="user && isDesktop" placement="bottom">
          <template #trigger>
            <button type="button" :aria-label="notifications.unread > 0 ? `Thông báo, ${notifications.unread} chưa đọc` : 'Thông báo'" :class="iconButtonClass" @click="ui.openDrawer('notifications')">
              <NBadge :value="notifications.unread" :show="notifications.unread > 0" dot color="#ea580c">
                <NIcon :size="20"><NotificationsOutline /></NIcon>
              </NBadge>
            </button>
          </template>
          Thông báo
        </NTooltip>

        <NTooltip placement="bottom">
          <template #trigger>
            <button type="button" aria-label="Giỏ hàng" :class="iconButtonClass" @click="openCart">
              <NBadge :value="cart.count" :show="cart.count > 0" :max="99" color="#ea580c">
                <NIcon :size="20"><CartOutline /></NIcon>
              </NBadge>
            </button>
          </template>
          Giỏ hàng
        </NTooltip>

        <NTooltip v-if="user && isDesktop" placement="bottom">
          <template #trigger>
            <button type="button" :aria-label="isAdmin ? 'Trang quản trị' : 'Đơn hàng'" :class="iconButtonClass" @click="router.push(isAdmin ? '/admin' : '/orders')">
              <NIcon :size="20"><GridOutline v-if="isAdmin" /><ReceiptOutline v-else /></NIcon>
            </button>
          </template>
          {{ isAdmin ? 'Trang quản trị' : 'Đơn hàng' }}
        </NTooltip>

        <NDropdown v-if="user" trigger="click" placement="bottom-end" :options="menuOptions" @select="onSelectMenu">
          <button
            type="button"
            :aria-label="notifications.unread > 0 ? `Menu tài khoản, ${notifications.unread} thông báo chưa đọc` : 'Menu tài khoản'"
            class="relative flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition hover:bg-orange-50"
          >
            <NBadge :value="notifications.unread" :show="notifications.unread > 0" dot color="#ea580c">
              <NAvatar round :size="36" color="#ea580c" class="text-base font-semibold">
                {{ user.fullName?.charAt(0).toUpperCase() }}
              </NAvatar>
            </NBadge>
          </button>
        </NDropdown>
        <NButton v-else type="default" size="small" @click="router.push('/login')">Đăng nhập</NButton>
      </div>
    </div>
  </header>
</template>
