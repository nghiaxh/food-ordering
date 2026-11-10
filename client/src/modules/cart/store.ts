import { defineStore } from 'pinia'
import type { CartItem, Food } from '@/shared/types'
import { addCartItem, clearCart, getCart, removeCartItem, setCartItemQuantity } from '@/modules/cart/api'
import { useAuthStore } from '@/modules/auth/store'
import { message } from '@/shared/api/message'

/** Giỏ chỉ tồn tại cho tài khoản đã đăng nhập; khách vãng lai không có giỏ local. */
const loggedIn = () => !!useAuthStore().user

/**
 * Thay dòng optimistic bằng CartItem server trả: food đầy đủ field, price là số và
 * available đúng, nên món thêm từ chatbot không còn hiện "Hết món" giả.
 */
const withServerItem = (items: CartItem[], item: CartItem): CartItem[] => {
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

const beginRequest = (foodId: number) => {
  const seq = (requestSeq.get(foodId) ?? 0) + 1
  requestSeq.set(foodId, seq)
  return { seq, generation: cartGeneration }
}

const canApply = (foodId: number, token: { seq: number; generation: number }) =>
  token.generation === cartGeneration && requestSeq.get(foodId) === token.seq

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    loaded: !loggedIn(),
  }),
  getters: {
    count: (state) => state.items.reduce((n, i) => n + i.quantity, 0),
    total: (state) => state.items.reduce((sum, i) => sum + (i.food?.price ?? 0) * i.quantity, 0),
  },
  actions: {
    async load() {
      if (!loggedIn()) {
        this.items = []
        this.loaded = true
        return
      }
      try {
        this.items = await getCart()
        this.loaded = true
      } catch {
        // Không cần báo lỗi; giỏ sẽ thử lại ở lần tải sau.
        this.loaded = true
      }
    },

    async add(food: Food, quantity = 1): Promise<boolean> {
      // UI đã chặn khách; store vẫn kiểm tra lần nữa để không ai tạo được giỏ local.
      if (!loggedIn()) return false
      const token = beginRequest(food.id)
      const before = this.items
      const existing = before.find((i) => i.food?.id === food.id)
      this.items = existing
        ? before.map((i) => (i.food?.id === food.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...before, { food, quantity }]
      try {
        const saved = await addCartItem(food.id, quantity)
        if (canApply(food.id, token)) this.items = withServerItem(this.items, saved)
        return true
      } catch {
        if (canApply(food.id, token)) this.items = before
        message.error('Không thêm được món vào giỏ. Vui lòng thử lại.')
        return false
      }
    },

    async setQuantity(foodId: number, quantity: number) {
      if (!loggedIn()) return
      const token = beginRequest(foodId)
      const before = this.items
      const current = before.find((i) => i.food?.id === foodId)
      if (!current) return
      this.items = before.map((i) => (i.food?.id === foodId ? { ...i, quantity } : i))
      try {
        const saved = await setCartItemQuantity(foodId, quantity)
        if (canApply(foodId, token)) this.items = withServerItem(this.items, saved)
      } catch {
        if (canApply(foodId, token)) this.items = before
        message.error('Không cập nhật được giỏ hàng. Vui lòng thử lại.')
      }
    },

    async remove(foodId: number) {
      if (!loggedIn()) return
      // Request đang bay của chính món này không được dựng lại dòng vừa xoá.
      beginRequest(foodId)
      const before = this.items
      this.items = before.filter((i) => i.food?.id !== foodId)
      try {
        await removeCartItem(foodId)
      } catch {
        this.items = before
        message.error('Không xóa được món khỏi giỏ. Vui lòng thử lại.')
      }
    },

    async clear() {
      if (!loggedIn()) return
      const before = this.items
      cartGeneration += 1
      this.items = []
      try {
        await clearCart()
      } catch {
        this.items = before
        message.error('Không xóa được giỏ hàng. Vui lòng thử lại.')
      }
    },

    resetLocal() {
      cartGeneration += 1
      this.items = []
      this.loaded = true
    },
  },
})
