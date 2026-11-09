import { useEffect } from 'react'
import { Drawer, Empty, Skeleton } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import { useUiStore } from '../store/uiStore'
import { formatRelativeTime } from '../utils/format'
import UiButton from './UiButton'

/**
 * Thông báo chuyển từ popover trên header sang drawer để header còn một hàng ở mobile.
 * Nội dung và thao tác giữ nguyên: đánh dấu đã đọc, xóa từng cái, xóa các thông báo đã đọc,
 * bấm vào thông báo có đơn thì mở đúng đơn.
 */
export default function NotificationsDrawer() {
  const navigate = useNavigate()
  const open = useUiStore((s) => s.activeDrawer === 'notifications')
  const closeDrawer = useUiStore((s) => s.closeDrawer)
  const items = useNotificationStore((s) => s.items)
  const loading = useNotificationStore((s) => s.loading)
  const load = useNotificationStore((s) => s.load)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearRead = useNotificationStore((s) => s.clearRead)
  const removeOne = useNotificationStore((s) => s.removeOne)
  const openNotification = useNotificationStore((s) => s.open)

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const unread = items.filter((n) => !n.read).length

  return (
    <Drawer
      open={open}
      onClose={closeDrawer}
      placement="right"
      size="min(420px, 100vw)"
      title={
        <div className="flex items-center gap-2">
          <span>Thông báo</span>
          {unread > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {unread} mới
            </span>
          )}
        </div>
      }
      extra={
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-amber-700 hover:underline"
              onClick={() => void markAllRead()}
            >
              Đã đọc
            </button>
          )}
          {items.some((n) => n.read) && (
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-stone-500 hover:text-rose-600 hover:underline"
              onClick={() => void clearRead()}
            >
              Xóa đã đọc
            </button>
          )}
        </div>
      }
    >
      {loading && items.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo nào" />
      ) : (
        <div className="space-y-1.5">
          {items.map((n) => (
            <div
              key={n.id}
              data-testid="notification-item"
              data-read={n.read ? 'true' : 'false'}
              className={`group relative rounded-xl text-sm ${
                n.read ? 'text-stone-500 hover:bg-stone-50' : 'bg-amber-50/80 font-medium text-stone-800'
              }`}
            >
              <button
                type="button"
                className="block w-full cursor-pointer rounded-xl px-3 py-2.5 pr-9 text-left"
                onClick={async () => {
                  const orderId = await openNotification(n)
                  closeDrawer()
                  if (orderId !== null) navigate(`/orders?orderId=${orderId}`)
                }}
              >
                <span
                  className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                    n.read ? 'bg-stone-200' : 'bg-amber-500'
                  }`}
                />
                {n.content}
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  {formatRelativeTime(n.createdAt)}
                </span>
              </button>
              <button
                type="button"
                aria-label="Xóa thông báo này"
                onClick={() => void removeOne(n.id)}
                className="absolute right-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full text-stone-400 transition hover:bg-white hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <UiButton kind="default" className="mt-4 w-full" onClick={closeDrawer}>
          Đóng
        </UiButton>
      )}
    </Drawer>
  )
}
