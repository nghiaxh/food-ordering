import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Drawer, Dropdown, type MenuProps } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { adminGetOrders } from '../api/api'
import UiIcon from '../components/UiIcon'
import UiButton from '../components/UiButton'
import { useAuthStore } from '../store/authStore'

interface NavItem {
  label: string
  to: string
  icon: string
}

// Thứ tự theo việc quán làm hằng ngày, không theo thứ tự bảng trong tài liệu.
const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', to: '/admin/dashboard', icon: 'home' },
  { label: 'Đơn hàng', to: '/admin/orders', icon: 'inbox' },
  { label: 'Khách hàng', to: '/admin/customers', icon: 'users' },
  { label: 'Món ăn', to: '/admin/foods', icon: 'tag' },
  { label: 'Danh mục', to: '/admin/categories', icon: 'th-large' },
  { label: 'Khuyến mãi', to: '/admin/promotions', icon: 'fire' },
  { label: 'Chatbot', to: '/admin/chatbot', icon: 'message' },
  { label: 'Báo cáo', to: '/admin/reports', icon: 'file' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)

  useEffect(() => {
    adminGetOrders()
      .then((orders) => setPendingOrdersCount(orders.filter((o) => o.status === 'PENDING').length))
      .catch(() => {})
  }, [location.pathname])

  const close = () => setDrawerOpen(false)

  const accountMenu: MenuProps = {
    items: [
      { key: 'account', label: 'Tài khoản', icon: <UiIcon name="user" size={16} /> },
      { key: 'store', label: 'Xem trang khách', icon: <UiIcon name="home" size={16} /> },
      { key: 'logout', label: 'Đăng xuất', icon: <UiIcon name="sign-out" size={16} /> },
    ],
    onClick: ({ key }) => {
      if (key === 'account') navigate('/profile')
      else if (key === 'store') navigate('/')
      else {
        logout()
        navigate('/')
      }
    },
  }

  const current = NAV_ITEMS.find((i) => i.to === location.pathname)

  const nav = (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={close}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? 'bg-amber-50 font-semibold text-amber-800'
                : 'font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            <UiIcon name={item.icon} size={16} />
            <span className="flex-1">{item.label}</span>
            {item.to === '/admin/orders' && pendingOrdersCount > 0 && (
              <Badge count={pendingOrdersCount} size="small" color="#d97706" />
            )}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Button
            type="text"
            aria-label="Mở menu quản trị"
            className="lg:hidden"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
          />

          {current && <span className="text-sm font-medium text-stone-700">{current.label}</span>}

          <div className="ml-auto flex items-center gap-1.5">
            <UiButton
              kind="icon"
              size="small"
              aria-label="Xem trang khách"
              icon={<UiIcon name="home" size={18} />}
              onClick={() => navigate('/')}
            />
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                aria-label="Menu tài khoản"
                className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-stone-50"
              >
                <Avatar size={30} style={{ backgroundColor: '#d97706' }}>
                  {user?.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <span className="hidden text-sm font-medium text-stone-700 sm:inline">{user?.fullName}</span>
              </button>
            </Dropdown>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 rounded-xl border border-stone-200/70 bg-white p-2.5">{nav}</div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={close}
        placement="left"
        size={Math.min(280, Math.round(window.innerWidth * 0.8))}
        styles={{ body: { padding: 12 } }}
      >
        {nav}
      </Drawer>
    </div>
  )
}
