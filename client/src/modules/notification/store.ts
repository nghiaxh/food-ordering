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
 * Một nguồn dữ liệu thông báo cho cả header (số chưa đọc) và drawer (danh sách).
 * Header và drawer cùng đọc store này nên hai nơi không bao giờ lệch số.
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
        // Lỗi mạng không được làm hỏng header; lần mở sau sẽ thử lại.
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
        // Thao tác phụ, để lần tải sau phản ánh trạng thái thật.
      }
    },

    async clearRead() {
      try {
        await deleteReadNotifications()
        this.items = this.items.filter((n) => !n.read)
      } catch {
        // Bỏ qua lỗi phụ.
      }
    },

    async removeOne(id: number) {
      try {
        await deleteNotification(id)
        this.items = this.items.filter((n) => n.id !== id)
      } catch {
        // Bỏ qua lỗi phụ.
      }
    },

    /** Đánh dấu đã đọc rồi trả id đơn để nơi gọi tự điều hướng. */
    async open(item: NotificationItem): Promise<number | null> {
      if (!item.read) {
        try {
          await markNotificationRead(item.id)
          this.items = this.items.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        } catch {
          // Đánh dấu thất bại không chặn việc mở đơn.
        }
      }
      return item.orderId
    },

    reset() {
      this.items = []
    },
  },
})
