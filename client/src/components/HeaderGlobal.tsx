import { useEffect, useState } from 'react'
import { Avatar, Badge, Dropdown, Input, Popover, type MenuProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import UiIcon from './UiIcon'
import UiButton from './UiButton'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { deleteNotification, deleteReadNotifications, getNotifications, markNotificationsRead } from '../api/api'
import { DeleteOutlined } from '@ant-design/icons'
import type { NotificationItem } from '../types'

const NAV = [
  { to: '/', label: 'Trang chủ' },
  { to: '/foods', label: 'Thực đơn' },
  { to: '/orders', label: 'Đơn hàng' },
]

export default function HeaderGlobal() {
  const { user, logout } = useAuthStore()
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
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-lg text-white">
            🍜
          </span>
          Food<span className="text-amber-600">Ordering</span>
        </Link>

        {user?.role === 'ADMIN' && (
          <UiButton
            kind="icon"
            size="small"
            aria-label="Trang quản trị"
            icon={<UiIcon name="th-large" size={18} />}
            onClick={() => navigate('/admin/foods')}
          />
        )}

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
                          className={`group relative rounded-lg px-3 py-2 text-sm ${
                            n.read ? 'text-stone-500 hover:bg-stone-50' : 'bg-amber-50/70 font-medium text-stone-800'
                          }}`}
                        >
                          <div className="pr-6">
                            <span
                              className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                                n.read ? 'bg-stone-200' : 'bg-amber-500'
                              }}`}
                            />
                            {n.content}
                            <span className="mt-0.5 block text-xs font-normal text-stone-400">
                              {new Date(n.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeOne(n.id)}
                            className="absolute right-2 top-2 hidden text-stone-400 hover:text-rose-600 group-hover:block"
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
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `text-sm font-medium transition ${
                  isActive ? 'text-amber-600' : 'text-stone-600 hover:text-stone-900'
                }`
              }
            >
              Quản trị
            </NavLink>
          )}
        </nav>

        <Space size="small">
          <Badge count={count} size="small">
            <Button
              shape="circle"
              icon={<ShoppingCartOutlined />}
              onClick={() => navigate('/cart')}
              aria-label="Giỏ hàng"
            />
          </Badge>
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden text-sm font-medium text-stone-700 hover:text-amber-600 sm:inline"
              >
                {user.fullName}
              </Link>
              <Button onClick={() => { logout(); navigate('/') }}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
              <Button type="primary" onClick={() => navigate('/register')}>Đăng ký</Button>
            </>
          )}
        </Space>
      </div>
    </header>
  )
}
