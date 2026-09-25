export interface Category {
  id: number
  name: string
  slug: string
  imageUrl: string
}

export interface Food {
  id: number
  name: string
  category: Category | null
  description: string
  ingredients: string
  /** Đơn vị tiền tệ là VND. */
  price: number
  imageUrl: string
  servingSize: number
  /** 0 là không cay, 3 là mức cay cao nhất. */
  spicyLevel: number
  /** Các nhãn được lưu trong một chuỗi, phân tách bằng dấu phẩy. */
  dietaryTags: string
  allergens: string
  available: boolean
}

export interface AuthUser {
  token: string
  id: number
  email: string
  fullName: string
  role: 'CUSTOMER' | 'ADMIN'
}

export interface User {
  id: number
  email: string
  fullName: string
  phone: string
  address: string
  role: 'CUSTOMER' | 'ADMIN'
  active: boolean
  createdAt: string
}

export interface OrderItem {
  id: number
  food: Food
  quantity: number
  /** Giá được chụp lại lúc đặt món, không phải giá hiện tại của món. */
  price: number
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID'

export interface Order {
  id: number
  status: OrderStatus
  paymentMethod: string
  paymentStatus: PaymentStatus
  total: number
  receiverName: string
  phone: string
  address: string
  createdAt: string
  items: OrderItem[]
  user?: User
}

export interface CartItem {
  food: Food
  quantity: number
}

export interface NotificationItem {
  id: number
  content: string
  read: boolean
  createdAt: string
}

export interface Review {
  id: number
  userName: string
  rating: number
  comment: string
  createdAt: string
}

export interface FoodCard {
  id: number
  name: string
  price: string
  imageUrl: string
  categoryName: string | null
}

export interface ChatMessage {
  sender: 'USER' | 'BOT'
  content: string
  foods?: FoodCard[]
}

export interface ChatHistoryMessage {
  id: number
  /** Lịch sử của khách vãng lai có thể không gắn với user đã đăng nhập. */
  user: User | null
  sessionId: string
  sender: 'USER' | 'BOT'
  content: string
  createdAt: string
}

export interface KnowledgeDocument {
  id: number
  title: string
  content: string
  createdAt: string
}

export interface AiSetting {
  settingKey: string
  settingValue: string
}