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

/**
 * Bao gia do server tinh tren dung danh sach dong client dang hien thi; day la nguon
 * duy nhat cho moi con so tien trong gio. Quote khong doc lai gio DB.
 */
export const quoteCart = (items: { foodId?: number; quantity: number }[], signal?: AbortSignal) =>
  http.post<CartQuote>('/cart/quote', { items }, { signal }).then((r) => r.data)
