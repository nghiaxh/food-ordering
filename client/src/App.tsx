import { useEffect, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useCartStore } from './store/cartStore'
import DefaultLayout from './layouts/DefaultLayout'
import AdminLayout from './layouts/AdminLayout'
import FoodsPage from './pages/FoodsPage'
import FoodDetailPage from './pages/FoodDetailPage'
import ComboDetailPage from './pages/ComboDetailPage'
import CartPage from './pages/CartPage'
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
import AdminCombosPage from './pages/admin/AdminCombosPage'
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

/**
 * Đồng bộ giỏ khi đổi trạng thái đăng nhập: đã đăng nhập thì tải server, đăng xuất thì xóa giỏ của tài khoản khỏi state.
 */
function CartSync() {
  const user = useAuthStore((s) => s.user)
  const load = useCartStore((s) => s.load)
  const resetLocal = useCartStore((s) => s.resetLocal)

  useEffect(() => {
    // `load` sẽ hợp nhất bản nháp local trước khi tải giỏ chính thức từ server.
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
        {/* Bảng món là trang chủ; chi tiết món là route con nên hiện thành panel phủ
            mà vẫn giữ URL thật để thẻ món trong chatbot liên kết được. */}
        <Route path="/" element={<FoodsPage />}>
          <Route path="foods/:id" element={<FoodDetailPage />} />
          <Route path="combos/:id" element={<ComboDetailPage />} />
        </Route>
        <Route path="/foods" element={<Navigate to="/" replace />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
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
        <Route path="combos" element={<AdminCombosPage />} />
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
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#d97706',
          borderRadius: 10,
          fontFamily: 'Inter Variable, sans-serif',
          // Đồng bộ breakpoint AntD với Tailwind (640/768/1024/1280)
          screenSM: 640,
          screenMD: 768,
          screenLG: 1024,
          screenXL: 1280,
        },
      }}
    >
      <BrowserRouter>
        <ScrollManager />
        <CartSync />
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  )
}