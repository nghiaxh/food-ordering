import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '@/user/cart/store'

/** Thanh co dinh day dang chiem cho, de nut chatbot biet phai nhuong bao nhieu. */
export type BottomBar = 'checkout' | null

/**
 * Trang nao dang co thanh co dinh day. Checkout co thanh xac nhan. Widget chatbot la
 * nut noi nen phai nhuong cho, neu khong se bi thanh che.
 */
export const useHasBottomBar = () => {
  const route = useRoute()
  const cart = useCartStore()
  return computed<BottomBar>(() => (route.path === '/checkout' && cart.count > 0 ? 'checkout' : null))
}
