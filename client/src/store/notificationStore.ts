import { create } from 'zustand'
import {
  deleteNotification,
  deleteReadNotifications,
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
} from '../api/api'
import type { NotificationItem } from '../types'

interface NotificationState {
  items: NotificationItem[]
  loading: boolean
  load: () => Promise<void>
  markAllRead: () => Promise<void>
  clearRead: () => Promise<void>
  removeOne: (id: number) => Promise<void>
  /** Đánh dấu đã đọc rồi trả id đơn để nơi gọi tự điều hướng. */
  open: (item: NotificationItem) => Promise<number | null>
  reset: () => void
}

/**
 * Một nguồn dữ liệu thông báo cho cả header (số chưa đọc) và drawer (danh sách).
 * Trước đây header tự gọi API nên mở drawer sẽ phải gọi lần hai và hai nơi dễ lệch số.
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ items: await getNotifications(), loading: false })
    } catch {
      // Lỗi mạng không được làm hỏng header; lần mở sau sẽ thử lại.
      set({ items: [], loading: false })
    }
  },

  markAllRead: async () => {
    try {
      await markNotificationsRead()
      set({ items: get().items.map((n) => ({ ...n, read: true })) })
    } catch {
      // Thao tác phụ, để lần tải sau phản ánh trạng thái thật.
    }
  },

  clearRead: async () => {
    try {
      await deleteReadNotifications()
      set({ items: get().items.filter((n) => !n.read) })
    } catch {
      // Bỏ qua lỗi phụ.
    }
  },

  removeOne: async (id) => {
    try {
      await deleteNotification(id)
      set({ items: get().items.filter((n) => n.id !== id) })
    } catch {
      // Bỏ qua lỗi phụ.
    }
  },

  open: async (item) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id)
        set({ items: get().items.map((n) => (n.id === item.id ? { ...n, read: true } : n)) })
      } catch {
        // Đánh dấu thất bại không chặn việc mở đơn.
      }
    }
    return item.orderId
  },

  reset: () => set({ items: [], loading: false }),
}))
