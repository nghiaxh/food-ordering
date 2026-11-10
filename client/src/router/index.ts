import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import FoodsPage from '@/modules/menu/pages/FoodsPage.vue'
import FoodDetailPage from '@/modules/menu/pages/FoodDetailPage.vue'
import LoginPage from '@/modules/auth/pages/LoginPage.vue'
import RegisterPage from '@/modules/auth/pages/RegisterPage.vue'
import CheckoutPage from '@/modules/order/pages/CheckoutPage.vue'
import OrdersPage from '@/modules/order/pages/OrdersPage.vue'
import ProfilePage from '@/modules/user/pages/ProfilePage.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminDashboardPage from '@/modules/admin/pages/AdminDashboardPage.vue'
import AdminFoodsPage from '@/modules/admin/pages/AdminFoodsPage.vue'
import AdminCategoriesPage from '@/modules/admin/pages/AdminCategoriesPage.vue'
import AdminOrdersPage from '@/modules/admin/pages/AdminOrdersPage.vue'
import AdminCustomersPage from '@/modules/admin/pages/AdminCustomersPage.vue'
import AdminPromotionsPage from '@/modules/admin/pages/AdminPromotionsPage.vue'
import AdminReportsPage from '@/modules/admin/pages/AdminReportsPage.vue'
import AdminChatbotPage from '@/modules/admin/pages/AdminChatbotPage.vue'
import { useAuthStore } from '@/modules/auth/store'

/**
 * Route guard chỉ là UX — quyền thật vẫn do server kiểm tra ở /api/admin/** và
 * /api/cart/**. Admin không dùng luồng khách: bị đẩy về /admin.
 */
const routes = [
  { path: '/login', component: LoginPage },
  { path: '/register', component: RegisterPage },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', component: FoodsPage, meta: { customerOnly: true } },
      { path: 'foods/:id', component: FoodDetailPage, meta: { customerOnly: true } },
      { path: 'foods', redirect: '/' },
      { path: 'cart', redirect: '/checkout' },
      {
        path: 'checkout',
        component: CheckoutPage,
        meta: { requiresAuth: true, customerOnly: true },
      },
      {
        path: 'orders',
        component: OrdersPage,
        meta: { requiresAuth: true, customerOnly: true },
      },
      {
        path: 'profile',
        component: ProfilePage,
        meta: { requiresAuth: true },
      },
      { path: 'chatbot', redirect: '/' },
    ],
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', component: AdminDashboardPage },
      { path: 'foods', component: AdminFoodsPage },
      { path: 'categories', component: AdminCategoriesPage },
      { path: 'orders', component: AdminOrdersPage },
      { path: 'customers', component: AdminCustomersPage },
      { path: 'promotions', component: AdminPromotionsPage },
      { path: 'reports', component: AdminReportsPage },
      { path: 'chatbot', component: AdminChatbotPage },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const user = auth.user
  if (to.meta.customerOnly && user?.role === 'ADMIN') {
    return { path: '/admin' }
  }
  if (to.meta.requiresAdmin && user?.role !== 'ADMIN') {
    return user ? { path: '/' } : { path: '/login', state: { from: { pathname: to.path, search: '' } } }
  }
  if (to.meta.requiresAuth && !user) {
    return { path: '/login', state: { from: { pathname: to.path, search: '' } } }
  }
  return true
})
