import { useEffect, useState } from 'react'
import { Avatar, Badge, Dropdown, Input, Popover, type MenuProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import UiIcon from './UiIcon'
import UiButton from './UiButton'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { deleteNotification, deleteReadNotifications, getNotifications, markNotificationRead, markNotificationsRead } from '../api/api'
import { DeleteOutlined } from '@ant-design/icons'
import type { NotificationItem } from '../types'

/**
 * Thanh điều hướng dạng kiosk: nút trang chủ, ô tìm kiếm, nút đơn hàng, giỏ hàng, đăng nhập.
 * Logo không nằm ở đây mà ở các trang không có thanh điều hướng (đăng nhập, đăng ký).
 * Nút đơn hàng chỉ hiện khi đã đăng nhập vì trang `/orders` cần token; các trang con
 * khác vẫn nằm trong menu tài khoản.
 */
export default function HeaderGlobal() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = user?.role === 'ADMIN'
  const count = useCartStore((s) => s.count())
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  // Ô tìm kiếm ghi thẳng vào URL để trang thực đơn đọc được và người dùng chia sẻ
  // được đường dẫn đã lọc.
  const keyword = params.get('keyword') ?? ''
  const [draft, setDraft] = useState(keyword)

  useEffect(() => setDraft(keyword), [keyword])

  // Ghi từ khoá vào URL: đang ở trang chủ thì đè lên bộ lọc hiện có (category, min, max),
  // đang ở trang khác thì quay về "/" kèm từ khoá. Debounce và Enter cùng gọi hàm này
  // nên hai lối vào không lệch nhau; Enter áp dụng tức thì, không đợi debounce.
  const commitSearch = (draftValue: string) => {
    const next = new URLSearchParams(params)
    const value = draftValue.trim()
    if (value) next.set('keyword', value)
    else next.delete('keyword')
    if (location.pathname === '/') {
      setParams(next, { replace: true })
    } else {
      navigate(next.size > 0 ? `/?${next.toString()}` : '/')
    }
  }

  useEffect(() => {
    if (draft === keyword) return
    const timer = window.setTimeout(() => commitSearch(draft), 300)
    return () => window.clearTimeout(timer)
  }, [draft, keyword, params, setParams, navigate, location.pathname])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    getNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }, [user, location.pathname])

  const unread = notifications.filter((n) => !n.read).length

  const markAllRead = async () => {
    try {
      await markNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // Không cần báo lỗi cho thao tác phụ; lần tải sau sẽ phản ánh đúng trạng thái.
    }
  }

  const clearRead = async () => {
    try {
      await deleteReadNotifications()
      setNotifications((prev) => prev.filter((n) => !n.read))
    } catch {
      // Bỏ qua lỗi phụ
    }
  }

  const removeOne = async (id: number) => {
    try {
      await deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      // Bỏ qua lỗi phụ
    }
  }

  // Đóng popover ngay để phản hồi tức thì; thông báo cũ không có orderId thì dừng ở đó.
  const openNotification = async (n: NotificationItem) => {
    setNotifOpen(false)
    if (!n.read) {
      try {
        await markNotificationRead(n.id)
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      } catch {
        // Đánh dấu đã đọc thất bại không chặn việc mở đơn.
      }
    }
    if (n.orderId !== null) navigate(`/orders?orderId=${n.orderId}`)
  }

  const accountMenu: MenuProps = {
    items: [
      ...(!isAdmin
        ? [{ key: 'orders', label: 'Đơn hàng của tôi', icon: <UiIcon name="inbox" size={16} /> }]
        : []),
      { key: 'account', label: 'Tài khoản', icon: <UiIcon name="user" size={16} /> },
      { type: 'divider' as const },
      { key: 'logout', label: 'Đăng xuất', icon: <UiIcon name="sign-out" size={16} /> },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/')
        return
      }
      navigate({ pathname: key === 'admin' ? '/admin/foods' : `/${key === 'orders' ? 'orders' : 'profile'}` })
    },
  }

  // Responsive layout: bỏ flex-wrap trên desktop, giữ header một hàng.
  // Dưới md, chuông + đơn hàng xuống hàng thứ hai để ô tìm kiếm không bị bóp.
  const notificationsButton = (
    <>
      {user && (
        <Popover
          trigger="click"
          placement="bottomRight"
          arrow={false}
          open={notifOpen}
          onOpenChange={(open) => {
            setNotifOpen(open)
            if (open) getNotifications().then(setNotifications).catch(() => setNotifications([]))
          }}
          content={
            <div style={{ width: 'min(320px, calc(100vw - 2rem))' }}>
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-sm font-semibold text-stone-800">Thông báo</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-amber-700 hover:underline"
                      onClick={() => void markAllRead()}
                    >
                      Đã đọc
                    </button>
                  )}
                  {notifications.some((n) => n.read) && (
                    <button
                      type="button"
                      className="text-xs font-medium text-stone-400 hover:text-rose-600 hover:underline"
                      onClick={() => void clearRead()}
                      title="Xóa các thông báo đã đọc"
                    >
                      Xóa đã đọc
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-stone-400">Chưa có thông báo nào.</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={`group relative rounded-lg text-sm ${
                        n.read ? 'text-stone-500 hover:bg-stone-50' : 'bg-amber-50/70 font-medium text-stone-800'
                      }`}
                    >
                      {/* Vùng bấm chính là button riêng, không lồng nút xóa bên trong. */}
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className="block w-full rounded-lg px-3 py-2 pr-8 text-left"
                      >
                        <span
                          className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                            n.read ? 'bg-stone-200' : 'bg-amber-500'
                          }`}
                        />
                        {n.content}
                        <span className="mt-0.5 block text-xs font-normal text-stone-400">
                          {new Date(n.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void removeOne(n.id)
                        }}
                        className="absolute right-2 top-2 text-stone-400 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        title="Xóa thông báo này"
                      >
                        <DeleteOutlined className="text-xs" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          }
        >
          <Badge count={unread} size="small" color="#d97706">
            <UiButton
              kind="icon"
              size="small"
              aria-label="Thông báo"
              icon={<UiIcon name="bell" size={18} />}
            />
          </Badge>
        </Popover>
      )}

      {user && (
        <UiButton
          kind="icon"
          size="small"
          aria-label="Đơn hàng"
          icon={<UiIcon name="inbox" size={18} />}
          onClick={() => navigate('/orders')}
        />
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/95 backdrop-blur-xl">
      {/* Desktop: một hàng, ô tìm kiếm flex-1. Mobile: hai hàng, tìm kiếm phía trái, phụ
          phía phải hàng dưới. */}
      <div className="mx-auto flex min-h-[3.25rem] max-w-[1600px] flex-wrap items-center gap-1.5 px-3 sm:gap-2 sm:px-4 md:gap-3 md:flex-nowrap md:px-5">
        {/* Hàng chính desktop */}
        {isAdmin ? (
          <UiButton
            kind="icon"
            size="small"
            aria-label="Về trang quản trị"
            icon={<UiIcon name="arrow-left" size={18} />}
            onClick={() => navigate('/admin')}
          />
        ) : (
          <UiButton
            kind="icon"
            size="small"
            aria-label="Trang chủ"
            icon={<UiIcon name="home" size={18} />}
            onClick={() => navigate('/')}
          />
        )}



        {/* Chặn bề rộng: không có `max-w` thì trên màn hình rộng ô tìm kiếm giãng hết
            chiều ngang còn lại, nhóm nút bên phải bị đẩy lệch ra rìa. */}
        {!isAdmin && (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={() => commitSearch(draft)}
            prefix={<SearchOutlined style={{ color: '#a8a29e' }} />}
            placeholder="Tìm món theo tên..."
            allowClear
            aria-label="Tìm món"
            className="min-w-0 flex-1 [&_.ant-input]:h-8 [&_.ant-input]:py-0"
          />
        )}

        {/* Cụm phải desktop: chuông, giỏ, đơn hàng, tài khoản. Thứ tự cố định để nhóm nút
            không nhảy chỗ khi số thông báo hoặc giỏ đổi. */}
        <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
          {!isAdmin && notificationsButton}
          {!isAdmin && (
            <Badge count={count} size="small" color="#d97706">
              <UiButton
                kind="icon"
                size="small"
                aria-label="Giỏ hàng"
                icon={<UiIcon name="shopping-cart" size={18} />}
                onClick={() => navigate('/cart')}
              />
            </Badge>
          )}
          {user ? (
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                aria-label="Menu tài khoản"
                className="flex items-center gap-2 rounded-full p-1 transition hover:bg-amber-50"
              >
                <Avatar style={{ backgroundColor: '#d97706' }}>
                  {user.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <span className="hidden text-sm font-medium text-stone-700 sm:inline">
                  {user.fullName}
                </span>
              </button>
            </Dropdown>
          ) : (
            <>
              <UiButton kind="default" size="small" onClick={() => navigate('/login')}>
                Đăng nhập
              </UiButton>
              <UiButton kind="primary" size="small" onClick={() => navigate('/register')}>
                Đăng ký
              </UiButton>
            </>
          )}
        </div>

        {/* Cụm phải mobile: giỏ + đăng nhập, gọn hơn để không bóp tìm kiếm */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:hidden">
          {isAdmin ? (
            <>
              {user && (
                <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
                  <button
                    type="button"
                    aria-label="Menu tài khoản"
                    className="flex items-center gap-2 rounded-full p-1 transition hover:bg-amber-50"
                  >
                    <Avatar style={{ backgroundColor: '#d97706' }}>
                      {user.fullName.charAt(0).toUpperCase()}
                    </Avatar>
                  </button>
                </Dropdown>
              )}
            </>
          ) : (
            <>
              <Badge count={count} size="small" color="#d97706">
                <UiButton
                  kind="icon"
                  size="small"
                  aria-label="Giỏ hàng"
                  icon={<UiIcon name="shopping-cart" size={18} />}
                  onClick={() => navigate('/cart')}
                />
              </Badge>
              {user ? (
                <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
                  <button
                    type="button"
                    aria-label="Menu tài khoản"
                    className="flex items-center gap-2 rounded-full p-1 transition hover:bg-amber-50"
                  >
                    <Avatar style={{ backgroundColor: '#d97706' }}>
                      {user.fullName.charAt(0).toUpperCase()}
                    </Avatar>
                  </button>
                </Dropdown>
              ) : (
                <>
                  <UiButton kind="default" size="small" onClick={() => navigate('/login')}>
                    Đăng nhập
                  </UiButton>
                  <UiButton kind="primary" size="small" onClick={() => navigate('/register')}>
                    Đăng ký
                  </UiButton>
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile hàng thứ hai: chuông + đơn hàng */}
        {!isAdmin && (
          <div className="flex w-full items-center justify-end gap-2 md:hidden">
            {notificationsButton}
          </div>
        )}
      </div>
    </header>
  )


}
