import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import FoodsPage from '@/user/menu/pages/FoodsPage.vue'
import FoodDetailPage from '@/user/menu/pages/FoodDetailPage.vue'
import LoginPage from '@/user/auth/pages/LoginPage.vue'
import RegisterPage from '@/user/auth/pages/RegisterPage.vue'
import CheckoutPage from '@/user/order/pages/CheckoutPage.vue'
import OrdersPage from '@/user/order/pages/OrdersPage.vue'
import ProfilePage from '@/user/profile/pages/ProfilePage.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminDashboardPage from '@/admin/dashboard/pages/AdminDashboardPage.vue'
import AdminFoodsPage from '@/admin/menu/pages/AdminFoodsPage.vue'
import AdminCategoriesPage from '@/admin/menu/pages/AdminCategoriesPage.vue'
import AdminOrdersPage from '@/admin/order/pages/AdminOrdersPage.vue'
import AdminCustomersPage from '@/admin/customer/pages/AdminCustomersPage.vue'
import AdminPromotionsPage from '@/admin/promotion/pages/AdminPromotionsPage.vue'
import AdminReportsPage from '@/admin/report/pages/AdminReportsPage.vue'
import AdminChatbotPage from '@/admin/chatbot/pages/AdminChatbotPage.vue'
import { useAuthStore } from '@/user/auth/store'

/**
 * Route guard chi la UX - quyen that van do server kiem tra o /api/admin/** va
 * /api/cart/**. Admin khong dung luong khach: bi day ve /admin.
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
