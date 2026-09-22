import { Badge, Button, Space } from 'antd'
import { ShoppingCartOutlined } from '@ant-design/icons'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'

const NAV = [
  { to: '/', label: 'Trang chủ' },
  { to: '/foods', label: 'Thực đơn' },
  { to: '/orders', label: 'Đơn hàng' },
]

export default function HeaderGlobal() {
  const { user, logout } = useAuthStore()
  const count = useCartStore((s) => s.count())
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-lg text-white">
            🍜
          </span>
          Food<span className="text-amber-600">Ordering</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition ${
                  isActive ? 'text-amber-600' : 'text-stone-600 hover:text-stone-900'
                }`
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