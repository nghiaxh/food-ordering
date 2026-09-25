import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import DefaultLayout from './layouts/DefaultLayout'
import HomePage from './pages/HomePage'
import FoodsPage from './pages/FoodsPage'
import FoodDetailPage from './pages/FoodDetailPage'
import CartPage from './pages/CartPage'
import OrdersPage from './pages/OrdersPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage, { RegisterPage } from './pages/AuthPages'
import AdminPage from './pages/admin/AdminPage'

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
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth admin>
            <AdminPage />
          </RequireAuth>
        }
      />

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
      theme={{ token: { colorPrimary: '#d97706', borderRadius: 10, fontFamily: 'Inter Variable, sans-serif' } }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  )
}