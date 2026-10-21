import { useEffect, useState } from 'react'
import { Avatar, Badge, Dropdown, Input, Popover, type MenuProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import UiIcon from './UiIcon'
import UiButton from './UiButton'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { getNotifications, markNotificationsRead } from '../api/api'
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
  const count = useCartStore((s) => s.count())
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  // Ô tìm kiếm ghi thẳng vào URL để trang thực đơn đọc được và người dùng chia sẻ
  // được đường dẫn đã lọc. `replace` tránh mỗi ký tự lại thêm một mục lịch sử.
  const keyword = params.get('keyword') ?? ''
  const [draft, setDraft] = useState(keyword)

  useEffect(() => setDraft(keyword), [keyword])

  useEffect(() => {
    if (draft === keyword) return
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (draft.trim()) next.set('keyword', draft.trim())
      else next.delete('keyword')
      setParams(next, { replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [draft, keyword, params, setParams])

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

  const accountMenu: MenuProps = {
    items: [
      { key: 'orders', label: 'Đơn hàng của tôi', icon: <UiIcon name="inbox" size={16} /> },
      { key: 'account', label: 'Tài khoản', icon: <UiIcon name="user" size={16} /> },
      ...(user?.role === 'ADMIN'
        ? [{ key: 'admin', label: 'Trang quản trị', icon: <UiIcon name="th-large" size={16} /> }]
        : []),
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

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[3.25rem] max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-5">
        {/* Không đặt logo ở thanh điều hướng để dành chỗ cho ô tìm kiếm; thương hiệu hiện ở
            các trang không có thanh này (đăng nhập, đăng ký). Nút trang chủ giữ đường về
            bảng món cho những trang con như /cart, /orders, /profile. */}
        <UiButton
          kind="icon"
          size="small"
          aria-label="Trang chủ"
          icon={<UiIcon name="home" size={18} />}
          onClick={() => navigate('/')}
        />

        {/* Chặn bề rộng: không có `max-w` thì trên màn hình rộng ô tìm kiếm giãng hết
            chiều ngang còn lại, nhóm nút bên phải bị đẩy lệch ra rìa. */}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => navigate('/')}
          prefix={<SearchOutlined style={{ color: '#a8a29e' }} />}
          placeholder="Tìm món theo tên..."
          allowClear
          aria-label="Tìm món"
          className="min-w-0 flex-1 md:max-w-xl"
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user && (
            <Popover
              trigger="click"
              placement="bottomRight"
              arrow={false}
              onOpenChange={(open) => {
                if (open) getNotifications().then(setNotifications).catch(() => setNotifications([]))
              }}
              content={
                <div style={{ width: 'min(320px, calc(100vw - 2rem))' }}>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-sm font-semibold text-stone-800">Thông báo</span>
                    {unread > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-amber-700 hover:underline"
                        onClick={() => void markAllRead()}
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-sm text-stone-400">Chưa có thông báo nào.</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            n.read ? 'text-stone-500' : 'bg-amber-50 font-medium text-stone-800'
                          }`}
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
        </div>
      </div>
    </header>
  )
}