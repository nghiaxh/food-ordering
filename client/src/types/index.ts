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
  price: number
  imageUrl: string
  servingSize: number
  spicyLevel: number
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