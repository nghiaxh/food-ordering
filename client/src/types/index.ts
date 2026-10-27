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
  /** Giá sau khuyến mãi tự động; server tính, client chỉ hiển thị. */
  discountedPrice?: number | null
  discountAmount?: number | null
  discountPercent?: number | null
  /** Nhãn ưu đãi, ví dụ "Cuối tuần", "Hôm nay". */
  discountLabel?: string | null
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

export interface ComboItem {
  id: number
  food: Food
  quantity: number
}

export interface Combo {
  id: number
  name: string
  description: string
  imageUrl: string
  price: number
  available: boolean
  items: ComboItem[]
  discountedPrice?: number | null
  discountAmount?: number | null
  discountPercent?: number | null
  discountLabel?: string | null
}

export interface OrderItem {
  id: number
  food: Food | null
  combo: Combo | null
  quantity: number
  /** Giá được chụp lại lúc đặt món, không phải giá hiện tại của món. */
  price: number
  discountAmount?: number
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED'

export interface Order {
  id: number
  status: OrderStatus
  paymentMethod: string
  total: number
  discountTotal?: number
  promotionCode?: string | null
  receiverName: string
  phone: string
  address: string
  createdAt: string
  items: OrderItem[]
  user?: User
}

export interface CartItem {
  food: Food | null
  combo: Combo | null
  quantity: number
}

/** Địa chỉ đã lưu của user; đơn hàng vẫn chụp riêng thông tin giao hàng khi đặt. */
export interface SavedAddress {
  id: number
  label: string
  receiverName: string
  phone: string
  address: string
  isDefault: boolean
  createdAt: string
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

export interface Promotion {
  id: number
  name: string
  description?: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxDiscount?: number | null
  minOrderTotal?: number | null
  scope: 'GLOBAL' | 'CATEGORY' | 'FOOD' | 'COMBO'
  targetIds?: number[]
  code?: string | null
  startsAt: string
  endsAt: string
  daysOfWeek?: string | null
  active: boolean
  priority: number
  stackable: boolean
  usageLimit?: number | null
  usedCount: number
  randomCount?: number
  claimable?: boolean
  occasion?: string | null
}

/** Một dòng trong báo giá giỏ hàng; số tiền giảm do server tính. */
export interface QuoteLine {
  foodId: number | null
  comboId: number | null
  name: string
  imageUrl: string | null
  unitPrice: number
  lineDiscount: number
  quantity: number
  lineTotal: number
  discountLabel: string | null
}

export interface CartQuote {
  lines: QuoteLine[]
  subtotal: number
  discountTotal: number
  total: number
  voucherCode: string | null
  voucherName: string | null
}

/** Voucher trong ví khách; `used` là đã dùng cho một đơn trước đó. */
export interface VoucherView {
  id: number
  code: string
  name: string
  description: string | null
  occasion: string | null
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxDiscount: number | null
  minOrderTotal: number | null
  endsAt: string
  claimed: boolean
  used: boolean
}
