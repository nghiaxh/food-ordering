// Giỏ hàng theo tài khoản: thêm món theo thứ tự request, thay dòng tạm bằng CartItem server trả.
import { defineStore } from 'pinia'
import type { CartItem, Food } from '@/shared/types'
import { addCartItem, clearCart, getCart, removeCartItem, setCartItemQuantity } from '@/user/cart/api'
import { useAuthStore } from '@/user/auth/store'
import { message } from '@/shared/api/message'

/** Gio chi ton tai cho tai khoan da dang nhap; khach vang lai khong co gio local. */
const loggedIn = () => !!useAuthStore().user

/**
 * Thay dong optimistic bang CartItem server tra: food day du field, price la so va
 * available dung, nen mon them tu chatbot khong con hien "Het mon" gia.
 */
const withServerItem = (items: CartItem[], item: CartItem): CartItem[] => {
  const id = item.food?.id
  if (id == null) return items
  return items.some((i) => i.food?.id === id)
    ? items.map((i) => (i.food?.id === id ? item : i))
    : [...items, item]
}

/**
 * So thu tu request theo tung mon: chi response cua request moi nhat duoc ghi vao gio.
 * So sanh so luong khong du tin vi response ve muon van co the mang so khac dong dang hien thi
 * (vi du server da cong don tu thiet bi khac) va khi do dong tam giu nguyen object thieu field.
 */
const requestSeq = new Map<number, number>()

/** Tang khi xoa sach gio de response dang bay khong dung lai dong vua xoa. */
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
        // Khong can bao loi; gio se thu lai o lan tai sau.
        this.loaded = true
      }
    },

    async add(food: Food, quantity = 1): Promise<boolean> {
      // UI da chan khach; store van kiem tra lan nua de khong ai tao duoc gio local.
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
      // Request dang bay cua chinh mon nay khong duoc dung lai dong vua xoa.
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
