import { useEffect, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useCartStore } from './store/cartStore'
import DefaultLayout from './layouts/DefaultLayout'
import HomePage from './pages/HomePage'
import FoodsPage from './pages/FoodsPage'
import FoodDetailPage from './pages/FoodDetailPage'
import CartPage from './pages/CartPage'
import OrdersPage from './pages/OrdersPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage, { RegisterPage } from './pages/AuthPages'
import AdminFoodsPage from './pages/admin/AdminFoodsPage'
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage'
import AdminOrdersPage from './pages/admin/AdminOrdersPage'
import AdminCustomersPage from './pages/admin/AdminCustomersPage'
import AdminChatbotPage from './pages/admin/AdminChatbotPage'
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
        <Route path="/" element={<HomePage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/foods/:id" element={<FoodDetailPage />} />
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

        <Route
          path="/admin"
          element={
            <RequireAuth admin>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/foods" replace />} />
          <Route path="foods" element={<AdminFoodsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="chatbot" element={<AdminChatbotPage />} />
        </Route>
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