import http from '@/shared/api/http'
import type { NotificationItem } from '@/shared/types'

export const getNotifications = (signal?: AbortSignal) =>
  http.get<NotificationItem[]>('/notifications', { signal }).then((r) => r.data)

export const markNotificationsRead = () => http.post('/notifications/read-all')

export const markNotificationRead = (id: number) => http.post(`/notifications/${id}/read`)

export const deleteReadNotifications = () => http.delete('/notifications/read')

export const deleteNotification = (id: number) => http.delete(`/notifications/${id}`)
