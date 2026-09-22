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
    <>
      <header
        className={`sticky top-0 z-50 bg-white/90 backdrop-blur-xl transition-shadow duration-200 ${
          scrolled ? 'shadow-sm' : 'border-b border-stone-200/70'
        }`}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6">
          <div className="flex items-center justify-self-start">
            <div className="md:hidden">
              <Button
                type="text"
                aria-label="Mở menu"
                className="mr-1"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            </div>
            <Link to="/" className="flex items-center gap-2 text-lg font-bold text-stone-900">
              <img src="/favicon.svg" alt="FoodOrdering" className="h-8 w-8 rounded-xl" />
              <span className="text-lg font-bold text-stone-900">
                Food<span className="text-amber-600">Ordering</span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-6 md:flex lg:gap-7 justify-self-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={scrollHome}
                className={`relative text-sm font-medium transition-colors hover:text-amber-600 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-amber-600 after:content-[''] ${
                  isActive(link) ? 'text-amber-600 after:opacity-100' : 'text-stone-600 after:opacity-0'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 justify-self-end">
            <Badge count={count} size="small" color="#d97706">
              <Button
                shape="circle"
                aria-label="Giỏ hàng"
                icon={<UiIcon name="shopping-cart" size={20} />}
                onClick={() => navigate('/cart')}
              />
            </Badge>

            {user ? (
              <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
                <button
                  type="button"
                  aria-label="Menu tài khoản"
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-amber-50"
                >
                  <Avatar style={{ backgroundColor: '#d97706' }}>{user.fullName.charAt(0).toUpperCase()}</Avatar>
                  <span className="hidden text-sm font-medium text-stone-700 sm:inline">{user.fullName}</span>
                </button>
              </Dropdown>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                  Đăng nhập
                </Button>
                <Button type="primary" onClick={() => navigate('/register')}>
                  Đăng ký
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        placement="right"
        title={
          <span className="flex items-center gap-2 font-bold text-stone-900">
            <img src="/favicon.svg" alt="FoodOrdering" className="h-7 w-7 rounded-lg" />
            Food<span className="text-amber-600">Ordering</span>
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