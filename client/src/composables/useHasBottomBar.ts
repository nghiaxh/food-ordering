import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '@/user/cart/store'

export type BottomBar = 'checkout' | null

// Xac dinh trang co thanh co dinh day de widget chatbot tranh bi che.
export const useHasBottomBar = () => {
  const route = useRoute()
  const cart = useCartStore()
  return computed<BottomBar>(() => (route.path === '/checkout' && cart.count > 0 ? 'checkout' : null))
}
