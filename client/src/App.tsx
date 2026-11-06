import { useEffect, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useCartStore } from './store/cartStore'
import theme from './theme'
import DefaultLayout from './layouts/DefaultLayout'
import AdminLayout from './layouts/AdminLayout'
import FoodsPage from './pages/FoodsPage'
import FoodDetailPage from './pages/FoodDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import OrdersPage from './pages/OrdersPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage, { RegisterPage } from './pages/AuthPages'
import AdminFoodsPage from './pages/admin/AdminFoodsPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage'
import AdminOrdersPage from './pages/admin/AdminOrdersPage'
import AdminCustomersPage from './pages/admin/AdminCustomersPage'
import AdminChatbotPage from './pages/admin/AdminChatbotPage'
import AdminPromotionsPage from './pages/admin/AdminPromotionsPage'
import AdminReportsPage from './pages/admin/AdminReportsPage'
import ScrollManager from './components/ScrollManager'

/**
 * Route guard phía client chỉ hỗ trợ điều hướng UX; quyền thực tế vẫn do server kiểm tra.
 */
function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    // Lưu vị trí hiện tại để sau khi đăng nhập người dùng quay lại đúng trang đang truy cập.
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (admin && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

/** Admin không dùng luồng khách: redirect mọi truy cập trang khách về khu vực quản trị. */
function RequireCustomer({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />
  }
  return <>{children}</>
}

/**
 * Đồng bộ giỏ khi đổi trạng thái đăng nhập: đã đăng nhập thì tải giỏ từ server,
 * đăng xuất thì xoá giỏ của tài khoản khỏi state. Khách vãng lai không có giỏ.
 */
function CartSync() {
  const user = useAuthStore((s) => s.user)
  const load = useCartStore((s) => s.load)
  const resetLocal = useCartStore((s) => s.resetLocal)

  useEffect(() => {
    if (user) {
      void load()
    } else {
      resetLocal()
    }
  }, [user, load, resetLocal])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<DefaultLayout />}>
        {/* Bảng món là trang chủ, cuộn trong vùng riêng. Chi tiết món là trang độc lập
            nên không còn lồng dưới "/" và không cần Outlet trong FoodsPage. */}
        <Route path="/" element={<RequireCustomer><FoodsPage /></RequireCustomer>} />
        <Route path="/foods/:id" element={<RequireCustomer><FoodDetailPage /></RequireCustomer>} />
        <Route path="/foods" element={<Navigate to="/" replace />} />
        <Route path="/cart" element={<Navigate to="/checkout" replace />} />
        <Route
          path="/checkout"
          element={
            <RequireCustomer>
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            </RequireCustomer>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireCustomer>
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            </RequireCustomer>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
      </Route>

      {/* Trang quản trị dùng layout riêng nên tách khỏi DefaultLayout của khách hàng. */}
      <Route
        path="/admin"
        element={
          <RequireAuth admin>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="foods" element={<AdminFoodsPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="chatbot" element={<AdminChatbotPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <BrowserRouter>
        <ScrollManager />
        <CartSync />
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  )
}