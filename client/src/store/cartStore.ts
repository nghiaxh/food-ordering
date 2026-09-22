import { create } from 'zustand'
import type { Food } from '../types'

export interface CartItem {
  food: Food
  quantity: number
}

interface CartState {
  items: CartItem[]
  add: (food: Food, quantity?: number) => void
  setQuantity: (foodId: number, quantity: number) => void
  remove: (foodId: number) => void
  clear: () => void
  count: () => number
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  add: (food, quantity = 1) =>
    set((s) => {
      const existing = s.items.find((i) => i.food.id === food.id)
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.food.id === food.id ? { ...i, quantity: i.quantity + quantity } : i,
          ),
        }
      }
      return { items: [...s.items, { food, quantity }] }
    }),
  setQuantity: (foodId, quantity) =>
    set((s) => ({
      items: s.items.map((i) => (i.food.id === foodId ? { ...i, quantity } : i)),
    })),
  remove: (foodId) => set((s) => ({ items: s.items.filter((i) => i.food.id !== foodId) })),
  clear: () => set({ items: [] }),
  count: () => get().items.reduce((n, i) => n + i.quantity, 0),
  total: () => get().items.reduce((sum, i) => sum + i.food.price * i.quantity, 0),
}))