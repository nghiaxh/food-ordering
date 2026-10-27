import http from './http'
import type { AuthUser, CartItem, CartQuote, Category, ChatHistoryMessage, ChatMessage, Combo, Food, FoodCard, NotificationItem, Order, OrderStatus, Promotion, Review, SavedAddress, User, VoucherView } from '../types'

/** Dữ liệu biểu mẫu quản trị tạo/sửa đơn hàng. */
export interface AdminOrderPayload {
  customerEmail: string
  /** Bỏ trống khi chỉ sửa thông tin giao hàng của đơn đã xác nhận. */
  items?: { foodId?: number; comboId?: number; quantity: number }[]
  receiverName: string
  phone: string
  address: string
  paymentMethod: string
  note?: string
  status?: OrderStatus
  paid?: boolean
  voucherCode?: string
}

/** Dữ liệu biểu mẫu quản trị tạo/sửa tài khoản khách hàng. */
export interface UserPayload {
  email: string
  fullName: string
  phone?: string
  address?: string
  /** Để trống khi sửa nghĩa là giữ mật khẩu hiện tại. */
  password?: string
}

// ----- Auth -----
export const login = (email: string, password: string) =>
  http.post<AuthUser>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: { email: string; password: string; fullName: string; phone?: string; address?: string }) =>
  http.post<AuthUser>('/auth/register', data).then((r) => r.data)

export const getMe = (signal?: AbortSignal) => http.get<User>('/auth/me', { signal }).then((r) => r.data)

export const updateMe = (data: { fullName: string; phone: string; address: string }) =>
  http.put('/auth/me', data).then((r) => r.data)

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  http.put('/auth/password', data)

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
  items: { foodId?: number; comboId?: number; quantity: number }[]
  receiverName: string
  phone: string
  address: string
  paymentMethod: string
  note?: string
  voucherCode?: string
}) => http.post<Order>('/orders', data).then((r) => r.data)

export const getMyOrders = (signal?: AbortSignal) =>
  http.get<Order[]>('/orders/my', { signal }).then((r) => r.data)

/** Chỉ đơn còn chờ xác nhận mới hủy được; server trả lỗi nếu đơn đã vào chế biến. */
export const cancelOrder = (id: number) => http.patch<Order>(`/orders/${id}/cancel`).then((r) => r.data)

/** Thanh toán giả lập: khách tự xác nhận đã trả. */
export const payOrder = (id: number) => http.patch<Order>(`/orders/${id}/pay`).then((r) => r.data)

// ----- Địa chỉ -----
export interface AddressPayload {
  label?: string
  receiverName: string
  phone: string
  address: string
  isDefault?: boolean
}

export const getAddresses = (signal?: AbortSignal) =>
  http.get<SavedAddress[]>('/addresses', { signal }).then((r) => r.data)

export const saveAddress = (id: number | null, data: AddressPayload) =>
  id ? http.put<SavedAddress>(`/addresses/${id}`, data).then((r) => r.data) : http.post<SavedAddress>('/addresses', data).then((r) => r.data)

export const deleteAddress = (id: number) => http.delete(`/addresses/${id}`)

// ----- Giỏ hàng -----
export const getCart = (signal?: AbortSignal) =>
  http.get<CartItem[]>('/cart', { signal }).then((r) => r.data)

export const addCartItem = (foodId: number, quantity: number) =>
  http.post<CartItem>('/cart/items', { foodId, quantity }).then((r) => r.data)

export const addCartCombo = (comboId: number, quantity: number) =>
  http.post<CartItem>('/cart/combos', { comboId, quantity }).then((r) => r.data)

export const setCartComboQuantity = (comboId: number, quantity: number) =>
  http.patch<CartItem>(`/cart/combos/${comboId}`, { quantity }).then((r) => r.data)

export const removeCartCombo = (comboId: number) => http.delete(`/cart/combos/${comboId}`)

export const setCartItemQuantity = (foodId: number, quantity: number) =>
  http.patch<CartItem>(`/cart/items/${foodId}`, { quantity }).then((r) => r.data)

export const removeCartItem = (foodId: number) => http.delete(`/cart/items/${foodId}`)

export const clearCart = () => http.delete('/cart')

/** Báo giá do server tính; đây là nguồn duy nhất cho mọi con số tiền trong giỏ. */
export const quoteCart = (voucherCode?: string) =>
  http.post<CartQuote>('/cart/quote', { voucherCode: voucherCode || null }).then((r) => r.data)

// ----- Thông báo -----
export const getNotifications = (signal?: AbortSignal) =>
  http.get<NotificationItem[]>('/notifications', { signal }).then((r) => r.data)

export const markNotificationsRead = () => http.post('/notifications/read-all')

export const deleteReadNotifications = () => http.delete('/notifications/read')

export const deleteNotification = (id: number) => http.delete(`/notifications/${id}`)

// ----- Đánh giá -----
export const getReviews = (foodId: number, signal?: AbortSignal) =>
  http.get<Review[]>(`/reviews/food/${foodId}`, { signal }).then((r) => r.data)

export const createReview = (data: { foodId: number; rating: number; comment: string }) =>
  http.post<Review>('/reviews', data).then((r) => r.data)

/** Sửa và xóa chỉ áp dụng cho đánh giá của chính người đang đăng nhập. */
export const updateReview = (id: number, data: { rating: number; comment: string }) =>
  http.put<Review>(`/reviews/${id}`, data).then((r) => r.data)

export const deleteReview = (id: number) => http.delete(`/reviews/${id}`)

// ----- Chatbot -----
export const chat = (message: string, sessionId: string) =>
  http.post<{ reply: string; foods: FoodCard[] }>('/chatbot/chat', { message, sessionId }).then((r) => r.data)

export type { ChatMessage }

// ----- Admin -----
export const adminSaveFood = (id: number | null, data: object) =>
  id ? http.put(`/admin/foods/${id}`, data) : http.post('/admin/foods', data)

export const adminDeleteFood = (id: number) => http.delete(`/admin/foods/${id}`)

export const adminSaveCategory = (id: number | null, data: { name: string; slug: string; imageUrl: string; description: string }) =>
  id ? http.put(`/admin/categories/${id}`, data) : http.post('/admin/categories', data)

export const adminDeleteCategory = (id: number) => http.delete(`/admin/categories/${id}`)

export const adminUploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return http.post<{ url: string }>('/admin/uploads/image', form).then((r) => r.data)
}

export const adminGetOrders = () => http.get<Order[]>('/admin/orders').then((r) => r.data)

export const adminSaveOrder = (id: number | null, data: AdminOrderPayload) =>
  id ? http.put(`/admin/orders/${id}`, data) : http.post('/admin/orders', data)

export const adminDeleteOrder = (id: number) => http.delete(`/admin/orders/${id}`)

export const adminUpdateOrderStatus = (id: number, status: string) =>
  http.patch(`/admin/orders/${id}/status`, { status })

export const adminUpdateOrderPayment = (id: number, paid: boolean) =>
  http.patch(`/admin/orders/${id}/payment`, null, { params: { paid } })

export const adminGetUsers = () => http.get<User[]>('/admin/users').then((r) => r.data)

export const adminSaveUser = (id: number | null, data: UserPayload) =>
  id ? http.put(`/admin/users/${id}`, data) : http.post('/admin/users', data)

export const adminDeleteUser = (id: number) => http.delete(`/admin/users/${id}`)

export const adminSetUserActive = (id: number, active: boolean) =>
  http.patch(`/admin/users/${id}/active`, null, { params: { active } })

export const adminGetChatHistory = () => http.get<ChatHistoryMessage[]>('/admin/chatbot/history').then((r) => r.data)

export const adminGetSettings = () => http.get<{ settingKey: string; settingValue: string }[]>('/admin/chatbot/settings').then((r) => r.data)

export const adminSaveSetting = (settingKey: string, settingValue: string) =>
  http.put('/admin/chatbot/settings', { settingKey, settingValue })

// ----- Combo -----
export const getCombos = (signal?: AbortSignal) =>
  http.get<Combo[]>('/combos', { signal }).then((r) => r.data)

export const getCombo = (id: number, signal?: AbortSignal) =>
  http.get<Combo>(`/combos/${id}`, { signal }).then((r) => r.data)

export const adminGetCombos = () => http.get<Combo[]>('/admin/combos').then((r) => r.data)

export const adminSaveCombo = (id: number | null, data: object) =>
  id ? http.put(`/admin/combos/${id}`, data) : http.post('/admin/combos', data)

export const adminDeleteCombo = (id: number) => http.delete(`/admin/combos/${id}`)

// ----- Khuyến mãi -----
export const getActiveVouchers = () =>
  http.get<Promotion[]>('/promotions/active').then((r) => r.data)

export const validateVoucher = (code: string, subtotal: number) =>
  http.post<Promotion>('/promotions/validate', { code, subtotal }).then((r) => r.data)

/** Voucher khách có thể nhận; khách vãng lai nhận danh sách nhưng không nhận được quà. */
export const getClaimableVouchers = (signal?: AbortSignal) =>
  http.get<VoucherView[]>('/promotions/claimable', { signal }).then((r) => r.data)

export const getMyVouchers = (signal?: AbortSignal) =>
  http.get<VoucherView[]>('/promotions/mine', { signal }).then((r) => r.data)

export const claimVoucher = (id: number) =>
  http.post<VoucherView>(`/promotions/${id}/claim`).then((r) => r.data)

/** Quà ngẫu nhiên mỗi ngày; server chặn nhận quá một lần trong ngày. */
export const claimLuckyVoucher = () =>
  http.post<VoucherView>('/promotions/lucky').then((r) => r.data)

export const adminGetPromotions = () => http.get<Promotion[]>('/admin/promotions').then((r) => r.data)

export const adminSavePromotion = (id: number | null, data: object) =>
  id ? http.put(`/admin/promotions/${id}`, data) : http.post('/admin/promotions', data)

export const adminDeletePromotion = (id: number) => http.delete(`/admin/promotions/${id}`)

// ----- Báo cáo -----
export interface ReportSummary {
  revenue: number
  orderCount: number
  completedCount: number
  avgOrder: number
  customerCount: number
  promotionUsage: number
  promotionDiscount: number
}

export const adminGetReportSummary = (from?: string, to?: string) =>
  http.get<ReportSummary>('/admin/reports/summary', { params: { from, to } }).then((r) => r.data)

export const adminGetReportRevenue = (from?: string, to?: string) =>
  http.get<{ date: string; revenue: number; orders: number }[]>('/admin/reports/revenue', { params: { from, to } }).then((r) => r.data)

export const adminGetReportTopFoods = (from?: string, to?: string, limit = 10) =>
  http.get<{ name: string; quantity: number; revenue: number }[]>('/admin/reports/top-foods', { params: { from, to, limit } }).then((r) => r.data)

export const adminExportReport = (from?: string, to?: string) =>
  http.get('/admin/reports/export', { params: { from, to }, responseType: 'blob' }).then((r) => r.data)
