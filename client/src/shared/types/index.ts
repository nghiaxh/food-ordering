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
  /** Don vi tien te la VND. */
  price: number
  imageUrl: string
  servingSize: number
  /** 0 la khong cay, 3 la muc cay cao nhat. */
  spicyLevel: number
  /** Cac nhan duoc luu trong mot chuoi, phan tach bang dau phay. */
  dietaryTags: string
  allergens: string
  available: boolean
  /** Gia sau khuyen mai tu dong; server tinh, client chi hien thi. */
  discountedPrice?: number | null
  discountAmount?: number | null
  discountPercent?: number | null
  /** Nhan uu dai, vi du "Cuoi tuan", "Hom nay". */
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
  /** Gia duoc chup lai luc dat mon, khong phai gia hien tai cua mon. */
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
  /** Ghi chu cua khach cho quan; null hoac rong nghia la khong co. */
  note?: string | null
  createdAt: string
  items: OrderItem[]
  user?: User
}

export interface CartItem {
  food: Food | null
  quantity: number
}

/** Dia chi da luu cua user; don hang van chup rieng thong tin giao hang khi dat. */
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
  /** Don lien quan; null voi thong bao cu nen chi danh dau da doc, khong dieu huong. */
  orderId: number | null
}

export interface Review {
  id: number
  userName: string
  rating: number
  /** Nhan xet khong bat buoc, khach co the chi cham sao. */
  comment: string | null
  createdAt: string
  /** Danh gia do chinh nguoi dang dang nhap viet thi moi hien nut Sua/Xoa. */
  mine: boolean
}

export interface FoodCard {
  id: number
  name: string
  price: string
  imageUrl: string
  categoryName: string | null
  /**
   * So phan khach can de du cho so nguoi an. Lon hon 1 khi khach noi ro so nguoi va khau
   * phan cua mon nho hon so do; server da tinh san nen client khong tu suy luan lai.
   */
  portions?: number
  /** Tong tien cua `portions` phan, dung de khach thay dung so tien phai tra. */
  totalPrice?: string
}

/** Nguon trich dan khi bot tra tai lieu quan; client hien duoi cau tra loi. */
export interface ChatCitation {
  sourceName: string
  snippet: string
}

export interface ChatMessage {
  sender: 'USER' | 'BOT'
  content: string
  foods?: FoodCard[]
  /** Nhom cau hoi: FOOD | RESTAURANT_INFO | ORDER_GUIDE | OUT_OF_SCOPE */
  intent?: string
  citations?: ChatCitation[]
  /** Cac nut hanh dong tiep theo do server quyet dinh; chi tin bot moi nhat con quickReplies. */
  quickReplies?: string[]
}

/** Trang thai tro ly; `notice` co cau nhac khi server chua cau hinh khoa API. */
export interface ChatbotStatus {
  available: boolean
  notice: string | null
}

export interface ChatHistoryMessage {
  id: number
  /** Lich su cua khach vang lai co the khong gan voi user da dang nhap. */
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

/** Tai lieu quan do admin nhap de chatbot tra cuu. */
export interface KnowledgeDoc {
  id: number
  title: string
  category: string | null
  keywords: string | null
  content: string
  enabled: boolean
  status?: string
  fileName?: string | null
  fileSize?: number | null
  chunkCount?: number
}

export interface KnowledgeChunkView {
  id: number
  chunkIndex: number
  content: string
}

export interface KnowledgeStats {
  totalDocuments: number
  totalChunks: number
  ready: number
  failed: number
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

/** Mot dong trong bao gia gio hang; so tien giam do server tinh. */
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
