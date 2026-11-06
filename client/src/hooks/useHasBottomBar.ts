import { useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'

/** Thanh cố định đáy đang chiếm chỗ, để nút chatbot biết phải nhường bao nhiêu. */
export type BottomBar = 'checkout' | null

/**
 * Trang nào đang có thanh cố định đáy. Checkout có thanh xác nhận. Widget chatbot là
 * nút nổi nên phải nhường chỗ, nếu không sẽ bị thanh che.
 */
export function useHasBottomBar(): BottomBar {
  const { pathname } = useLocation()
  const count = useCartStore((s) => s.count())

  if (pathname === '/checkout') return count > 0 ? 'checkout' : null
  return null
}
