import { defineStore } from 'pinia'
import type { NotificationItem } from '@/shared/types'
import {
  deleteNotification,
  deleteReadNotifications,
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
} from '@/modules/notification/api'

/**
 * Mot nguon du lieu thong bao cho ca header (so chua doc) va drawer (danh sach).
 * Header va drawer cung doc store nay nen hai noi khong bao gio lech so.
 */
export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationItem[],
    loading: false,
  }),
  getters: {
    unread: (state) => state.items.filter((n) => !n.read).length,
  },
  actions: {
    async load() {
      this.loading = true
      try {
        this.items = await getNotifications()
      } catch {
        // Loi mang khong duoc lam hong header; lan mo sau se thu lai.
        this.items = []
      } finally {
        this.loading = false
      }
    },

    async markAllRead() {
      try {
        await markNotificationsRead()
        this.items = this.items.map((n) => ({ ...n, read: true }))
      } catch {
        // Thao tac phu, de lan tai sau phan anh trang thai that.
      }
    },

    async clearRead() {
      try {
        await deleteReadNotifications()
        this.items = this.items.filter((n) => !n.read)
      } catch {
        // Bo qua loi phu.
      }
    },

    async removeOne(id: number) {
      try {
        await deleteNotification(id)
        this.items = this.items.filter((n) => n.id !== id)
      } catch {
        // Bo qua loi phu.
      }
    },

    /** Danh dau da doc roi tra id don de noi goi tu dieu huong. */
    async open(item: NotificationItem): Promise<number | null> {
      if (!item.read) {
        try {
          await markNotificationRead(item.id)
          this.items = this.items.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        } catch {
          // Danh dau that bai khong chan viec mo don.
        }
      }
      return item.orderId
    },

    reset() {
      this.items = []
    },
  },
})
