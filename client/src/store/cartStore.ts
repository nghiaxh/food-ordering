import { create } from 'zustand'
import { message } from 'antd'
import type { CartItem, Combo, Food } from '../types'
import { addCartItem, addCartCombo, clearCart, getCart, removeCartItem, removeCartCombo, setCartComboQuantity, setCartItemQuantity } from '../api/api'
import { useAuthStore } from './authStore'

interface CartState {
  items: CartItem[]
  loaded: boolean
  load: () => Promise<void>
  add: (food: Food, quantity?: number) => Promise<void>
  addCombo: (combo: Combo, quantity?: number) => Promise<void>
  setComboQuantity: (comboId: number, quantity: number) => Promise<void>
  removeCombo: (comboId: number) => Promise<void>
  setQuantity: (foodId: number, quantity: number) => Promise<void>
  remove: (foodId: number) => Promise<void>
  clear: () => Promise<void>
  resetLocal: () => void
  count: () => number
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  loaded: !loggedIn(),

  load: async () => {
    if (!loggedIn()) {
      set({ items: [], loaded: true })
      return
    }
    // Hợp nhất bản nháp của khách vào tài khoản trước khi đọc lại giỏ từ server.
    const local = get().items
    for (const item of local) {
      try {
        if (item.food) await addCartItem(item.food.id, item.quantity)
        else if (item.combo) await addCartCombo(item.combo.id, item.quantity)
      } catch {
        /* giỏ local chỉ là bản nháp; server là nguồn chính thức */
      }
    }
    try {
      set({ items: await getCart(), loaded: true })
    } catch {
      message.error('Không tải được giỏ hàng từ máy chủ')
      set({ loaded: true })
    }
  },

  add: async (food, quantity = 1) => {
    if (!loggedIn()) {
      const existing = get().items.find((i) => i.food?.id === food.id)
      set({
        items: existing
          ? get().items.map((i) => (i.food?.id === food.id ? { ...i, quantity: i.quantity + quantity } : i))
          : [...get().items, { food, combo: null, quantity }],
      })
      return
    }
    const before = get().items
    const existing = before.find((i) => i.food?.id === food.id)
    set({
      items: existing
        ? before.map((i) => (i.food?.id === food.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...before, { food, combo: null, quantity }],
    })
    try {
      await addCartItem(food.id, quantity)
    } catch {
      set({ items: before })
      message.error('Không thêm được món vào giỏ. Vui lòng thử lại.')
    }
  },

  addCombo: async (combo, quantity = 1) => {
    if (!loggedIn()) {
      const existing = get().items.find((i) => i.combo?.id === combo.id)
      set({
        items: existing
          ? get().items.map((i) => (i.combo?.id === combo.id ? { ...i, quantity: i.quantity + quantity } : i))
          : [...get().items, { food: null, combo, quantity }],
      })
      return
    }
    const before = get().items
    const existing = before.find((i) => i.combo?.id === combo.id)
    set({
      items: existing
        ? before.map((i) => (i.combo?.id === combo.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...before, { food: null, combo, quantity }],
    })
    try {
      await addCartCombo(combo.id, quantity)
    } catch {
      set({ items: before })
      message.error('Không thêm được combo vào giỏ. Vui lòng thử lại.')
    }
  },

  setQuantity: async (foodId, quantity) => {
    const before = get().items
    set({ items: before.map((i) => (i.food?.id === foodId ? { ...i, quantity } : i)) })
    if (!loggedIn()) return
    try {
      await setCartItemQuantity(foodId, quantity)
    } catch {
      set({ items: before })
      message.error('Không cập nhật được giỏ hàng. Vui lòng thử lại.')
    }
  },

  setComboQuantity: async (comboId, quantity) => {
    const before = get().items
    set({ items: before.map((i) => (i.combo?.id === comboId ? { ...i, quantity } : i)) })
    if (!loggedIn()) return
    try {
      await setCartComboQuantity(comboId, quantity)
    } catch {
      set({ items: before })
      message.error('Không cập nhật được giỏ hàng. Vui lòng thử lại.')
    }
  },

  remove: async (foodId) => {
    const before = get().items
    set({ items: before.filter((i) => i.food?.id !== foodId) })
    if (!loggedIn()) return
    try {
      await removeCartItem(foodId)
    } catch {
      set({ items: before })
      message.error('Không xóa được món khỏi giỏ. Vui lòng thử lại.')
    }
  },

  removeCombo: async (comboId) => {
    const before = get().items
    set({ items: before.filter((i) => i.combo?.id !== comboId) })
    if (!loggedIn()) return
    try {
      await removeCartCombo(comboId)
    } catch {
      set({ items: before })
      message.error('Không xóa được combo khỏi giỏ. Vui lòng thử lại.')
    }
  },

  clear: async () => {
    const before = get().items
    set({ items: [] })
    if (!loggedIn()) return
    try {
      await clearCart()
    } catch {
      set({ items: before })
      message.error('Không xóa được giỏ hàng. Vui lòng thử lại.')
    }
  },

  resetLocal: () => set({ items: [], loaded: true }),
  count: () => get().items.reduce((n, i) => n + i.quantity, 0),
  total: () => get().items.reduce((sum, i) => sum + (i.food?.price ?? i.combo?.price ?? 0) * i.quantity, 0),
}))