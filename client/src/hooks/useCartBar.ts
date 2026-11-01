import { useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'

/**
 * Trang nào đang có thanh cố định đáy (tổng tiền + nút hành động). Các nút nổi
 * (chatbot, scroll to top) phải nhường chỗ cho thanh này để không bị che.
 */
export function useHasCartBar(): boolean {
  const { pathname } = useLocation()
  const count = useCartStore((s) => s.count())

  if (pathname === '/cart' || pathname === '/foods') return count > 0
  return /^\/foods\/\d+$/.test(pathname)
}
