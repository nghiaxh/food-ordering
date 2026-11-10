import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import FoodsPage from '@/modules/menu/pages/FoodsPage.vue'
import FoodDetailPage from '@/modules/menu/pages/FoodDetailPage.vue'
import LoginPage from '@/modules/auth/pages/LoginPage.vue'
import RegisterPage from '@/modules/auth/pages/RegisterPage.vue'
import PlaceholderPage from '@/components/PlaceholderPage.vue'
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
        component: PlaceholderPage,
        props: { title: 'Đặt món' },
        meta: { requiresAuth: true, customerOnly: true },
      },
      {
        path: 'orders',
        component: PlaceholderPage,
        props: { title: 'Đơn hàng' },
        meta: { requiresAuth: true, customerOnly: true },
      },
      {
        path: 'profile',
        component: PlaceholderPage,
        props: { title: 'Tài khoản' },
        meta: { requiresAuth: true },
      },
      { path: 'chatbot', redirect: '/' },
    ],
  },
  // Khu quản trị sẽ gắn AdminLayout và các trang thật ở branch refactor/client-admin-chatbot.
  {
    path: '/admin',
    component: PlaceholderPage,
    props: { title: 'Trang quản trị' },
    meta: { requiresAuth: true, requiresAdmin: true },
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
