import { useState } from 'react'
import { Avatar, Button, Drawer, Dropdown, type MenuProps } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import UiIcon from '../components/UiIcon'
import { useAuthStore } from '../store/authStore'

interface NavItem {
  label: string
  to: string
  icon: string
}

// Menu bên trái theo Bảng 2.22 tài liệu đặc tả, tách riêng khỏi giao diện khách hàng.
const NAV: NavItem[] = [
  { label: 'Món ăn', to: '/admin/foods', icon: 'tag' },
  { label: 'Danh mục', to: '/admin/categories', icon: 'th-large' },
  { label: 'Đơn hàng', to: '/admin/orders', icon: 'inbox' },
  { label: 'Khách hàng', to: '/admin/customers', icon: 'users' },
  { label: 'Chatbot', to: '/admin/chatbot', icon: 'message' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isActive = (item: NavItem) => location.pathname === item.to
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

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={close}
          aria-current={isActive(item) ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            isActive(item) ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          <UiIcon name={item.icon} size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Button
            type="text"
            aria-label="Mở menu quản trị"
            className="lg:hidden"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
          />
          <Link to="/admin/foods" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl" />
            <span className="text-base font-bold text-stone-900">
              Food<span className="text-amber-600">Ordering</span>
            </span>
            <span className="hidden rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 sm:inline">
              Trang quản trị
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="hidden text-sm font-medium text-stone-500 hover:text-amber-600 sm:inline">
              Xem trang khách
            </Link>
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                aria-label="Menu tài khoản"
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-amber-50"
              >
                <Avatar style={{ backgroundColor: '#d97706' }}>
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
          <div className="sticky top-24 rounded-2xl border border-stone-200/70 bg-white p-3">{nav}</div>
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
        title={
          <span className="font-bold text-stone-900">
            Menu quản <span className="text-amber-600">trị</span>
          </span>
        }
      >
        {nav}
      </Drawer>
    </div>
  )
}