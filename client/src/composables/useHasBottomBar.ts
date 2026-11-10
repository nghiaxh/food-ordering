import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '@/modules/cart/store'

/** Thanh cố định đáy đang chiếm chỗ, để nút chatbot biết phải nhường bao nhiêu. */
export type BottomBar = 'checkout' | null

/**
 * Trang nào đang có thanh cố định đáy. Checkout có thanh xác nhận. Widget chatbot là
 * nút nổi nên phải nhường chỗ, nếu không sẽ bị thanh che.
 */
export const useHasBottomBar = () => {
  const route = useRoute()
  const cart = useCartStore()
  return computed<BottomBar>(() => (route.path === '/checkout' && cart.count > 0 ? 'checkout' : null))
}
