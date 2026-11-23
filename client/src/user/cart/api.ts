import http from '@/shared/api/http'
import type { CartItem, CartQuote } from '@/shared/types'

export const getCart = (signal?: AbortSignal) =>
  http.get<CartItem[]>('/cart', { signal }).then((r) => r.data)

export const addCartItem = (foodId: number, quantity: number) =>
  http.post<CartItem>('/cart/items', { foodId, quantity }).then((r) => r.data)

export const setCartItemQuantity = (foodId: number, quantity: number) =>
  http.patch<CartItem>(`/cart/items/${foodId}`, { quantity }).then((r) => r.data)

export const removeCartItem = (foodId: number) => http.delete(`/cart/items/${foodId}`)

export const clearCart = () => http.delete('/cart')

export const quoteCart = (items: { foodId?: number; quantity: number }[], signal?: AbortSignal) =>
  http.post<CartQuote>('/cart/quote', { items }, { signal }).then((r) => r.data)
