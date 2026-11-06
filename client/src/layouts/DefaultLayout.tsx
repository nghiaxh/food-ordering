import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import HeaderGlobal from '../components/HeaderGlobal'
import ChatbotWidget from '../components/ChatbotWidget'
import CartDrawer from '../components/CartDrawer'
import NotificationsDrawer from '../components/NotificationsDrawer'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

/**
 * Layout phía khách: thanh điều hướng, drawer giỏ và thông báo, khung chatbot nổi.
 * Trang chủ tự khoá chiều cao một màn hình và cuộn trong vùng riêng; trang chi tiết món,
 * checkout, đơn hàng cuộn theo trang như bình thường.
 */
export default function DefaultLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const openCartAfterLogin = Boolean((location.state as { openCart?: boolean } | null)?.openCart)

  // Khách bấm giỏ khi chưa đăng nhập được đưa sang login kèm cờ này; quay lại thì mở giỏ luôn.
  useEffect(() => {
    if (!user || !openCartAfterLogin) return
    openDrawer('cart')
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [user, openCartAfterLogin, openDrawer, navigate, location.pathname, location.search])

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-stone-50">
        <HeaderGlobal />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <CartDrawer />
      <NotificationsDrawer />
      <ChatbotWidget />
    </>
  )
}
