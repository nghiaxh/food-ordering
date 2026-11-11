<script setup lang="ts">
import { computed, watch } from 'vue'
import { NButton, NDrawer, NEmpty, NIcon, NSkeleton } from 'naive-ui'
import { NotificationsOutline, CloseOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/modules/notification/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { formatRelativeTime } from '@/shared/utils/format'
import type { NotificationItem } from '@/shared/types'

/**
 * Thong bao chuyen tu popover tren header sang drawer de header con mot hang o mobile.
 * Thao tac giu nguyen: danh dau da doc, xoa tung cai, xoa cac thong bao da doc,
 * bam vao thong bao co don thi mo dung don.
 */
const router = useRouter()
const ui = useUiStore()
const notifications = useNotificationStore()
const show = computed(() => ui.activeDrawer === 'notifications')
const unread = computed(() => notifications.unread)

watch(show, (open) => {
  if (open) void notifications.load()
})

const onItemClick = async (item: NotificationItem) => {
  const orderId = await notifications.open(item)
  ui.closeDrawer()
  if (orderId !== null) router.push(`/orders?orderId=${orderId}`)
}
</script>

<template>
  <NDrawer :show="show" placement="right" :width="'min(420px, 100vw)'" :mask-closable="true" :auto-focus="false" @update:show="(v: boolean) => !v && ui.closeDrawer()">
    <template #header>
      <div class="flex items-center gap-2">
        <NIcon :size="18"><NotificationsOutline /></NIcon>
        <span class="text-base font-semibold text-stone-900">Thông báo</span>
        <span v-if="unread > 0" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          {{ unread }} mới
        </span>
      </div>
    </template>

    <template #header-extra>
      <div class="flex items-center gap-3">
        <button v-if="unread > 0" type="button" class="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-amber-700 hover:underline" @click="notifications.markAllRead()">
          Đã đọc
        </button>
        <button v-if="notifications.items.some((n) => n.read)" type="button" class="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-stone-500 hover:text-rose-600 hover:underline" @click="notifications.clearRead()">
          Xóa đã đọc
        </button>
      </div>
    </template>

    <template #default>
      <div v-if="notifications.loading && notifications.items.length === 0" class="p-5">
        <NSkeleton :repeat="4" height="48px" />
      </div>
      <NEmpty v-else-if="notifications.items.length === 0" class="py-16" description="Chưa có thông báo nào" />
      <div v-else class="space-y-1.5">
        <div
          v-for="n in notifications.items"
          :key="n.id"
          data-testid="notification-item"
          :data-read="n.read ? 'true' : 'false'"
          class="group relative rounded-xl text-sm"
          :class="n.read ? 'text-stone-500 hover:bg-stone-50' : 'bg-amber-50/80 font-medium text-stone-800'"
        >
          <button type="button" class="block w-full cursor-pointer rounded-xl px-3 py-2.5 pr-9 text-left" @click="onItemClick(n)">
            <span class="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" :class="n.read ? 'bg-stone-200' : 'bg-amber-500'" />
            {{ n.content }}
            <span class="mt-1 block text-xs font-normal text-stone-500">{{ formatRelativeTime(n.createdAt) }}</span>
          </button>
          <button
            type="button"
            aria-label="Xóa thông báo này"
            class="absolute right-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full text-stone-400 transition hover:bg-white hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            @click="notifications.removeOne(n.id)"
          >
            <NIcon :size="16"><CloseOutline /></NIcon>
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <NButton v-if="notifications.items.length > 0" block @click="ui.closeDrawer()">Đóng</NButton>
    </template>
  </NDrawer>
</template>
