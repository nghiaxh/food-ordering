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
import { useAuthStore } from '@/modules/auth/store'
import { useCartStore } from '@/modules/cart/store'
import { useNotificationStore } from '@/modules/notification/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { message } from '@/shared/api/message'

/**
 * Thanh điều hướng một hàng ở mọi kích thước: logo, ô tìm kiếm, đơn hàng, giỏ, tài khoản.
 * Từ `lg` thông báo và đơn hàng có nút riêng; dưới `lg` chúng nằm trong menu tài khoản.
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

// Ô tìm kiếm ghi thẳng vào URL để trang thực đơn đọc được và chia sẻ được đường dẫn đã lọc.
const keyword = computed(() => (Array.isArray(route.query.keyword) ? route.query.keyword[0] : route.query.keyword) ?? '')
const draft = ref(keyword.value)
watch(keyword, (value) => {
  draft.value = value
})

// Nạp lại số chưa đọc khi đổi tài khoản hoặc quay về từ trang đơn hàng.
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

/** Ghi từ khoá vào URL: ở trang chủ đè lên bộ lọc hiện có, ở trang khác thì về "/" kèm từ khoá. */
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

// Debounce 300ms; input trống vẫn ghi qua commitSearch để xoá từ khoá.
watch(draft, (value, _oldValue, onCleanup) => {
  if (value === keyword.value) return
  const timer = window.setTimeout(() => commitSearch(value), 300)
  onCleanup(() => window.clearTimeout(timer))
})

/** Giỏ cần đăng nhập; khách vãng lai được đưa sang đăng nhập rồi mở lại giỏ. */
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
                    { class: 'rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800' },
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
  'relative grid h-10 w-10 cursor-pointer place-items-center rounded-full text-stone-600 transition hover:bg-amber-50 hover:text-amber-800 focus-visible:outline-2'
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
              <NBadge :value="notifications.unread" :show="notifications.unread > 0" dot color="#b45309">
                <NIcon :size="20"><NotificationsOutline /></NIcon>
              </NBadge>
            </button>
          </template>
          Thông báo
        </NTooltip>

        <NTooltip placement="bottom">
          <template #trigger>
            <button type="button" aria-label="Giỏ hàng" :class="iconButtonClass" @click="openCart">
              <NBadge :value="cart.count" :show="cart.count > 0" :max="99" color="#b45309">
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
            class="relative flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition hover:bg-amber-50"
          >
            <NBadge :value="notifications.unread" :show="notifications.unread > 0" dot color="#b45309">
              <NAvatar round :size="36" color="#b45309" class="text-base font-semibold">
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
