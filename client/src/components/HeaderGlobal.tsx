import { useEffect, useState } from 'react'
import { Avatar, Badge, Dropdown, Input, message, type MenuProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BrandMark from './BrandMark'
import UiIcon from './UiIcon'
import UiButton from './UiButton'
import useMediaQuery from '../hooks/useMediaQuery'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useNotificationStore } from '../store/notificationStore'
import { useUiStore } from '../store/uiStore'

/**
 * Thanh điều hướng một hàng ở mọi kích thước: logo, ô tìm kiếm, đơn hàng, giỏ, tài khoản.
 * Từ `lg` thông báo và đơn hàng có nút riêng trên header vì hai mục này khách bấm thường
 * xuyên; dưới `lg` chúng nằm trong menu tài khoản để ô tìm kiếm còn chỗ.
 * Header luôn cao đúng `--header-h`, chatbot và vùng cuộn kiosk không bị lệch.
 */
export default function HeaderGlobal() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = user?.role === 'ADMIN'
  const count = useCartStore((s) => s.count())
  const openDrawer = useUiStore((s) => s.openDrawer)
  const notifications = useNotificationStore((s) => s.items)
  const loadNotifications = useNotificationStore((s) => s.load)
  const resetNotifications = useNotificationStore((s) => s.reset)
  const unread = notifications.filter((n) => !n.read).length

  // Ô tìm kiếm ghi thẳng vào URL để trang thực đơn đọc được và chia sẻ được đường dẫn đã lọc.
  const keyword = params.get('keyword') ?? ''
  const [draft, setDraft] = useState(keyword)

  useEffect(() => setDraft(keyword), [keyword])

  // Nạp lại số chưa đọc khi đổi tài khoản hoặc quay về từ trang đơn hàng.
  useEffect(() => {
    if (user) void loadNotifications()
    else resetNotifications()
  }, [user, location.pathname, loadNotifications, resetNotifications])

  /**
   * Ghi từ khoá vào URL: đang ở trang chủ thì đè lên bộ lọc hiện có, đang ở trang khác
   * (chi tiết món, đơn hàng) thì quay về "/" kèm từ khoá.
   */
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

  /** Giỏ cần đăng nhập; khách vãng lai được đưa sang đăng nhập rồi mở lại giỏ. */
  const openCart = () => {
    if (!user) {
      message.info('Đăng nhập để xem giỏ hàng')
      navigate('/login', { state: { from: { pathname: location.pathname, search: location.search }, openCart: true } })
      return
    }
    openDrawer('cart')
  }

  const accountMenu: MenuProps = {
    items: [
      // Màn hẹp: mọi mục nằm trong menu. Màn rộng: thông báo và đơn hàng đã có nút riêng
      // trên header nên menu chỉ giữ những mục ít bấm.
      ...(!isDesktop
        ? [
            {
              key: 'notifications',
              label: (
                <span className="flex items-center gap-2">
                  Thông báo
                  {unread > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      {unread}
                    </span>
                  )}
                </span>
              ),
              icon: <UiIcon name="bell" size={16} />,
            },
            isAdmin
              ? { key: 'admin', label: 'Trang quản trị', icon: <UiIcon name="th-large" size={16} /> }
              : { key: 'orders', label: 'Đơn hàng của tôi', icon: <UiIcon name="inbox" size={16} /> },
          ]
        : []),
      ...(isAdmin && isDesktop
        ? [{ key: 'admin', label: 'Trang quản trị', icon: <UiIcon name="th-large" size={16} /> }]
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
      if (key === 'notifications') {
        openDrawer('notifications')
        return
      }
      if (key === 'admin') {
        navigate('/admin/foods')
        return
      }
      navigate(key === 'orders' ? '/orders' : '/profile')
    },
  }

  return (
    <header className="sticky top-0 z-50 h-[var(--header-h)] border-b border-stone-200/70 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-1.5 px-3 sm:gap-3 sm:px-5">
        <BrandMark />

        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => commitSearch(draft)}
          prefix={<SearchOutlined style={{ color: '#a8a29e' }} />}
          placeholder="Tìm món..."
          allowClear
          aria-label="Tìm món"
          className="min-w-0 flex-1"
        />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {user && isDesktop && (
            <Badge dot={unread > 0} color="#b45309" offset={[-4, 4]}>
              <UiButton
                kind="icon"
                size="small"
                aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
                icon={<UiIcon name="bell" size={18} />}
                onClick={() => openDrawer('notifications')}
              />
            </Badge>
          )}

          <Badge count={count} size="small" color="#b45309">
            <UiButton
              kind="icon"
              size="small"
              aria-label="Giỏ hàng"
              icon={<UiIcon name="shopping-cart" size={18} />}
              onClick={openCart}
            />
          </Badge>

          {user && isDesktop && (
            <UiButton
              kind="icon"
              size="small"
              aria-label={isAdmin ? 'Trang quản trị' : 'Đơn hàng'}
              icon={<UiIcon name={isAdmin ? 'th-large' : 'inbox'} size={18} />}
              onClick={() => navigate(isAdmin ? '/admin/foods' : '/orders')}
            />
          )}

          {user ? (
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                aria-label={unread > 0 ? `Menu tài khoản, ${unread} thông báo chưa đọc` : 'Menu tài khoản'}
                className="relative flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition hover:bg-amber-50"
              >
                <Badge dot={unread > 0} color="#b45309" offset={[-2, 2]}>
                  <Avatar style={{ backgroundColor: '#b45309' }}>
                    {user.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </button>
            </Dropdown>
          ) : (
            <UiButton kind="default" size="small" onClick={() => navigate('/login')}>
              Đăng nhập
            </UiButton>
          )}
        </div>
      </div>
    </header>
  )
}
