import { useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'

/**
 * Trang nào đang có thanh giỏ ghim đáy. Widget chatbot là nút nổi nên phải nhường chỗ
 * cho thanh này, nếu không nút mở chatbot sẽ bị thanh giỏ che mất.
 */
export function useHasCartBar(): boolean {
  const { pathname } = useLocation()
  const count = useCartStore((s) => s.count())

  if (pathname === '/' || pathname === '/cart') return count > 0
  // Chi tiết món là panel phủ nằm trong Drawer nên thanh giỏ bảng món vẫn hiện bên dưới.
  return false
}