export interface Category {
  id: number
  name: string
  slug: string
  imageUrl: string
  description: string
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

export interface OrderItem {
  id: number
  food: Food | null
  quantity: number
  /** Giá được chụp lại lúc đặt món, không phải giá hiện tại của món. */
  price: number
  discountAmount?: number
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID'

export interface Order {
  id: number
  status: OrderStatus
  paymentMethod: string
  paymentStatus: PaymentStatus
  total: number
  discountTotal?: number
  receiverName: string
  phone: string
  address: string
  /** Ghi chú của khách cho quán; null hoặc rỗng nghĩa là không có. */
  note?: string | null
  createdAt: string
  items: OrderItem[]
  user?: User
}

export interface CartItem {
  food: Food | null
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
  /** Đánh giá do chính người đang đăng nhập viết thì mới hiện nút Sửa/Xóa. */
  mine: boolean
}

export interface FoodCard {
  id: number
  name: string
  price: string
  imageUrl: string
  categoryName: string | null
  /**
   * Số phần khách cần để đủ cho số người ăn. Lớn hơn 1 khi khách nói rõ số người và khẩu
   * phần của món nhỏ hơn số đó; server đã tính sẵn nên client không tự suy luận lại.
   */
  portions?: number
  /** Tổng tiền của `portions` phần, dùng để khách thấy đúng số tiền phải trả. */
  totalPrice?: string
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
  scope: 'GLOBAL' | 'CATEGORY' | 'FOOD'
  targetIds?: number[]
  startsAt: string
  endsAt: string
  daysOfWeek?: string | null
  active: boolean
  priority: number
  usageLimit?: number | null
  usedCount: number
  randomCount?: number
}

/** Một dòng trong báo giá giỏ hàng; số tiền giảm do server tính. */
export interface QuoteLine {
  foodId: number | null
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
}
