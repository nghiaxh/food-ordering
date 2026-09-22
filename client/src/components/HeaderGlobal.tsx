import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Drawer, Dropdown, type MenuProps } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import UiIcon from './UiIcon'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'

interface NavLink {
  label: string
  to: string
}

const links: NavLink[] = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Thực đơn', to: '/foods' },
  { label: 'Đơn hàng', to: '/orders' },
  { label: 'Về chúng tôi', to: '/#about' },
  { label: 'Liên hệ', to: '/#contact' },
]

export default function HeaderGlobal() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const count = useCartStore((s) => s.count())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = user?.role === 'ADMIN' ? [...links, { label: 'Quản trị', to: '/admin' }] : links

  const isActive = (link: NavLink): boolean => {
    if (link.to.startsWith('/#')) {
      return location.pathname === '/' && location.hash === link.to.slice(1)
    }
    if (link.to === '/') return location.pathname === '/'
    return location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)
  }

  const scrollHome = () => {
    if (location.pathname === '/' && !location.hash) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      window.scrollTo({ top: 0, behavior })
    }
  }

  const accountMenu: MenuProps = {
    items: [
      { key: 'account', label: 'Tài khoản', icon: <UiIcon name="user" size={16} /> },
      { key: 'logout', label: 'Đăng xuất', icon: <UiIcon name="sign-out" size={16} /> },
    ],
    onClick: ({ key }) => {
      if (key === 'account') {
        navigate('/profile')
      } else {
        logout()
        navigate('/')
      }
    },
  }

  const closeDrawer = () => setDrawerOpen(false)

  const drawerContent = (
    <nav className="flex flex-col gap-1">
      {navLinks.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={closeDrawer}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            isActive(link) ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          {link.label}
        </Link>
      ))}
      <div className="mt-3 border-t border-stone-200 pt-4">
        {user ? (
          <>
            <Link
              to="/profile"
              onClick={closeDrawer}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-amber-50 hover:text-amber-700"
            >
              <UiIcon name="user" size={16} /> Tài khoản
            </Link>
            <button
              type="button"
              onClick={() => {
                logout()
                closeDrawer()
                navigate('/')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-amber-50 hover:text-red-600"
            >
              <UiIcon name="sign-out" size={16} /> Đăng xuất
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              block
              onClick={() => {
                closeDrawer()
                navigate('/login')
              }}
            >
              Đăng nhập
            </Button>
            <Button
              type="primary"
              block
              onClick={() => {
                closeDrawer()
                navigate('/register')
              }}
            >
              Đăng ký
            </Button>
          </div>
        )}
      </div>
    </nav>
  )

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
        }
      >
        {drawerContent}
      </Drawer>
    </>
  )
}