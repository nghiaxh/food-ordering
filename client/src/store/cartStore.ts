import { create } from 'zustand'
import { message } from 'antd'
import type { CartItem, Food } from '../types'
import { addCartItem, clearCart, getCart, removeCartItem, setCartItemQuantity } from '../api/api'
import { useAuthStore } from './authStore'

interface CartState {
  items: CartItem[]
  loaded: boolean
  load: () => Promise<void>
  add: (food: Food, quantity?: number) => Promise<boolean>
  setQuantity: (foodId: number, quantity: number) => Promise<void>
  remove: (foodId: number) => Promise<void>
  clear: () => Promise<void>
  resetLocal: () => void
  count: () => number
  total: () => number
}

/** Giỏ chỉ tồn tại cho tài khoản đã đăng nhập; khách vãng lai không có giỏ local. */
function loggedIn(): boolean {
  return useAuthStore.getState().user !== null
}

/**
 * Thay dòng optimistic bằng CartItem server trả: food đầy đủ field, price là số và
 * available đúng, nên món thêm từ chatbot không còn hiện "Hết món" giả.
 */
function withServerItem(items: CartItem[], item: CartItem): CartItem[] {
  const id = item.food?.id
  if (id == null) return items
  return items.some((i) => i.food?.id === id)
    ? items.map((i) => (i.food?.id === id ? item : i))
    : [...items, item]
}

/**
 * Số thứ tự request theo từng món: chỉ response của request mới nhất được ghi vào giỏ.
 * So sánh số lượng không đủ tin vì response về muộn vẫn có thể mang số khác dòng đang hiển thị
 * (ví dụ server đã cộng dồn từ thiết bị khác) và khi đó dòng tạm giữ nguyên object thiếu field.
 */
const requestSeq = new Map<number, number>()

/** Tăng khi xoá sạch giỏ để response đang bay không dựng lại dòng vừa xoá. */
let cartGeneration = 0

function beginRequest(foodId: number): { seq: number; generation: number } {
  const seq = (requestSeq.get(foodId) ?? 0) + 1
  requestSeq.set(foodId, seq)
  return { seq, generation: cartGeneration }
}

function canApply(foodId: number, token: { seq: number; generation: number }): boolean {
  return token.generation === cartGeneration && requestSeq.get(foodId) === token.seq
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  loaded: !loggedIn(),

  load: async () => {
    if (!loggedIn()) {
      set({ items: [], loaded: true })
      return
    }
    try {
      set({ items: await getCart(), loaded: true })
    } catch {
      message.error('Không tải được giỏ hàng từ máy chủ')
      set({ loaded: true })
    }
  },

  add: async (food, quantity = 1) => {
    // UI đã chặn khách; store vẫn kiểm tra lần nữa để không ai tạo được giỏ local.
    if (!loggedIn()) return false
    const token = beginRequest(food.id)
    const before = get().items
    const existing = before.find((i) => i.food?.id === food.id)
    set({
      items: existing
        ? before.map((i) => (i.food?.id === food.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...before, { food, quantity }],
    })
    try {
      const saved = await addCartItem(food.id, quantity)
      if (canApply(food.id, token)) set({ items: withServerItem(get().items, saved) })
      return true
    } catch {
      if (canApply(food.id, token)) set({ items: before })
      message.error('Không thêm được món vào giỏ. Vui lòng thử lại.')
      return false
    }
  },

  setQuantity: async (foodId, quantity) => {
    if (!loggedIn()) return
    const token = beginRequest(foodId)
    const before = get().items
    const current = before.find((i) => i.food?.id === foodId)
    if (!current) return
    set({ items: before.map((i) => (i.food?.id === foodId ? { ...i, quantity } : i)) })
    try {
      const saved = await setCartItemQuantity(foodId, quantity)
      if (canApply(foodId, token)) set({ items: withServerItem(get().items, saved) })
    } catch {
      if (canApply(foodId, token)) set({ items: before })
      message.error('Không cập nhật được giỏ hàng. Vui lòng thử lại.')
    }
  },

  remove: async (foodId) => {
    if (!loggedIn()) return
    // Request đang bay của chính món này không được dựng lại dòng vừa xoá.
    beginRequest(foodId)
    const before = get().items
    set({ items: before.filter((i) => i.food?.id !== foodId) })
    try {
      await removeCartItem(foodId)
    } catch {
      set({ items: before })
      message.error('Không xóa được món khỏi giỏ. Vui lòng thử lại.')
    }
  },

  clear: async () => {
    if (!loggedIn()) return
    const before = get().items
    cartGeneration += 1
    set({ items: [] })
    try {
      await clearCart()
    } catch {
      set({ items: before })
      message.error('Không xóa được giỏ hàng. Vui lòng thử lại.')
    }
  },

  resetLocal: () => {
    cartGeneration += 1
    set({ items: [], loaded: true })
  },
  count: () => get().items.reduce((n, i) => n + i.quantity, 0),
  total: () => get().items.reduce((sum, i) => sum + (i.food?.price ?? 0) * i.quantity, 0),
}))
