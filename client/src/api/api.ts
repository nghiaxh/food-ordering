import http from './http'
import type { AuthUser, Category, CartItem, ChatHistoryMessage, ChatMessage, Food, FoodCard, KnowledgeDocument, NotificationItem, Order, Review, User } from '../types'

// ----- Auth -----
export const login = (email: string, password: string) =>
  http.post<AuthUser>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: { email: string; password: string; fullName: string; phone?: string; address?: string }) =>
  http.post<AuthUser>('/auth/register', data).then((r) => r.data)

export const getMe = (signal?: AbortSignal) => http.get<User>('/auth/me', { signal }).then((r) => r.data)

export const updateMe = (data: { fullName: string; phone: string; address: string }) =>
  http.put('/auth/me', data).then((r) => r.data)

// ----- Món ăn -----
export const getCategories = (signal?: AbortSignal) =>
  http.get<Category[]>('/categories', { signal }).then((r) => r.data)

export const getFoods = (
  params?: { keyword?: string; categoryId?: number; minPrice?: number; maxPrice?: number },
  signal?: AbortSignal,
) => http.get<Food[]>('/foods', { params, signal }).then((r) => r.data)

export const getFood = (id: number, signal?: AbortSignal) =>
  http.get<Food>(`/foods/${id}`, { signal }).then((r) => r.data)

// ----- Đơn hàng -----
export const createOrder = (data: {
  items: { foodId: number; quantity: number }[]
  receiverName: string
  phone: string
  address: string
  paymentMethod: string
}) => http.post<Order>('/orders', data).then((r) => r.data)

export const getMyOrders = (signal?: AbortSignal) =>
  http.get<Order[]>('/orders/my', { signal }).then((r) => r.data)

// ----- Giỏ hàng -----
export const getCart = (signal?: AbortSignal) =>
  http.get<CartItem[]>('/cart', { signal }).then((r) => r.data)

export const addCartItem = (foodId: number, quantity: number) =>
  http.post<CartItem>('/cart/items', { foodId, quantity }).then((r) => r.data)

export const setCartItemQuantity = (foodId: number, quantity: number) =>
  http.patch<CartItem>(`/cart/items/${foodId}`, { quantity }).then((r) => r.data)

export const removeCartItem = (foodId: number) => http.delete(`/cart/items/${foodId}`)

export const clearCart = () => http.delete('/cart')

// ----- Thông báo -----
export const getNotifications = (signal?: AbortSignal) =>
  http.get<NotificationItem[]>('/notifications', { signal }).then((r) => r.data)

export const markNotificationsRead = () => http.post('/notifications/read-all')

// ----- Đánh giá -----
export const getReviews = (foodId: number, signal?: AbortSignal) =>
  http.get<Review[]>(`/reviews/food/${foodId}`, { signal }).then((r) => r.data)

export const createReview = (data: { foodId: number; rating: number; comment: string }) =>
  http.post<Review>('/reviews', data).then((r) => r.data)

// ----- Chatbot -----
export const chat = (message: string, sessionId: string) =>
  http.post<{ reply: string; foods: FoodCard[] }>('/chatbot/chat', { message, sessionId }).then((r) => r.data)

export type { ChatMessage }

// ----- Admin -----
export const adminSaveFood = (id: number | null, data: object) =>
  id ? http.put(`/admin/foods/${id}`, data) : http.post('/admin/foods', data)

export const adminDeleteFood = (id: number) => http.delete(`/admin/foods/${id}`)

export const adminSaveCategory = (id: number | null, data: { name: string; slug: string; imageUrl: string }) =>
  id ? http.put(`/admin/categories/${id}`, data) : http.post('/admin/categories', data)

export const adminDeleteCategory = (id: number) => http.delete(`/admin/categories/${id}`)

export const adminGetOrders = () => http.get<Order[]>('/admin/orders').then((r) => r.data)

export const adminUpdateOrderStatus = (id: number, status: string) =>
  http.patch(`/admin/orders/${id}/status`, { status })

export const adminUpdateOrderPayment = (id: number, paid: boolean) =>
  http.patch(`/admin/orders/${id}/payment`, null, { params: { paid } })

export const adminGetUsers = () => http.get<User[]>('/admin/users').then((r) => r.data)

export const adminSetUserActive = (id: number, active: boolean) =>
  http.patch(`/admin/users/${id}/active`, null, { params: { active } })

export const adminGetChatHistory = () => http.get<ChatHistoryMessage[]>('/admin/chatbot/history').then((r) => r.data)

export const adminGetDocuments = () => http.get<KnowledgeDocument[]>('/admin/chatbot/documents').then((r) => r.data)

export const adminUploadDocument = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return http.post('/admin/chatbot/documents', form)
}

export const adminDeleteDocument = (id: number) => http.delete(`/admin/chatbot/documents/${id}`)

export const adminGetSettings = () => http.get<{ settingKey: string; settingValue: string }[]>('/admin/chatbot/settings').then((r) => r.data)

export const adminSaveSetting = (settingKey: string, settingValue: string) =>
  http.put('/admin/chatbot/settings', { settingKey, settingValue })