import type {
  Category,
  Food,
  Notification,
  Order,
  OrderItem,
  User,
} from "../generated/prisma/client.js";

export const toCategoryJson = (c: Category) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  imageUrl: c.imageUrl,
  description: c.description,
});

/**
 * Shape Food trả ra client. `discountedPrice`/`discountAmount`/`discountPercent`/`discountLabel`
 * là trường transient do lớp pricing điền (xem modules/pricing); chưa có thì bỏ hẳn khỏi JSON.
 */
export const toFoodJson = (food: Food & { category?: Category | null } & Record<string, unknown>) => {
  const extras: Record<string, unknown> = {};
  if (food.discountedPrice !== undefined) extras.discountedPrice = Number(food.discountedPrice);
  if (food.discountAmount !== undefined) extras.discountAmount = Number(food.discountAmount);
  if (food.discountPercent !== undefined) extras.discountPercent = food.discountPercent;
  if (food.discountLabel !== undefined) extras.discountLabel = food.discountLabel;
  return {
    id: food.id,
    name: food.name,
    category: food.category ? toCategoryJson(food.category) : null,
    description: food.description,
    ingredients: food.ingredients,
    price: Number(food.price),
    imageUrl: food.imageUrl,
    servingSize: food.servingSize,
    spicyLevel: food.spicyLevel,
    dietaryTags: food.dietaryTags,
    allergens: food.allergens,
    available: food.available,
    ...extras,
  };
};

export const toUserJson = (u: User) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  phone: u.phone,
  address: u.address,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt.toISOString(),
});

export const toCartItemJson = (item: { quantity: number; food: (Food & { category?: Category | null }) | null }) => ({
  food: item.food ? toFoodJson(item.food) : null,
  quantity: item.quantity,
});

export const toOrderItemJson = (item: OrderItem & { food: (Food & { category?: Category | null }) | null }) => ({
  id: item.id,
  food: item.food ? toFoodJson(item.food) : null,
  quantity: item.quantity,
  /** Giá được chụp lại lúc đặt món, không phải giá hiện tại của món. */
  price: Number(item.price),
  discountAmount: Number(item.discountAmount),
});

export const toOrderJson = (
  order: Order & {
    items?: Array<OrderItem & { food: (Food & { category?: Category | null }) | null }>;
    user?: User | null;
  },
) => ({
  id: order.id,
  ...(order.user ? { user: toUserJson(order.user) } : {}),
  status: order.status,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  total: Number(order.total),
  discountTotal: Number(order.discountTotal),
  receiverName: order.receiverName,
  phone: order.phone,
  address: order.address,
  note: order.note,
  createdAt: order.createdAt.toISOString(),
  items: (order.items ?? []).map(toOrderItemJson),
});

export const toNotificationJson = (n: Notification) => ({
  id: n.id,
  content: n.content,
  read: n.read,
  createdAt: n.createdAt.toISOString(),
  /** Đơn liên quan; null với thông báo cũ nên chỉ đánh dấu đã đọc, không điều hướng. */
  orderId: n.orderId,
});
