import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums khop voi Postgres enum hien tai.
export const roleEnum = pgEnum("Role", ["CUSTOMER", "ADMIN"]);

export const orderStatusEnum = pgEnum("OrderStatus", [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "COMPLETED",
  "CANCELLED",
]);

export const paymentStatusEnum = pgEnum("PaymentStatus", ["UNPAID", "PAID"]);

export const paymentTransactionStatusEnum = pgEnum("PaymentTransactionStatus", [
  "PENDING",
  "PAID",
]);

export const messageSenderEnum = pgEnum("MessageSender", ["USER", "BOT"]);

export const discountTypeEnum = pgEnum("DiscountType", ["PERCENT", "FIXED"]);

export const promotionScopeEnum = pgEnum("PromotionScope", [
  "GLOBAL",
  "CATEGORY",
  "FOOD",
]);

// Tables.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  role: roleEnum("role").default("CUSTOMER").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addressLabel: varchar("address_label", { length: 255 }),
  receiverName: varchar("receiver_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  address: text("address").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  slug: varchar("slug", { length: 255 }),
  imageUrl: text("image_url"),
  description: text("description"),
});

export const foods = pgTable("foods", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  description: text("description"),
  ingredients: text("ingredients"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  servingSize: integer("serving_size").default(1).notNull(),
  spicyLevel: integer("spicy_level").default(0).notNull(),
  dietaryTags: text("dietary_tags"),
  allergens: text("allergens"),
  available: boolean("available").default(true).notNull(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    foodId: integer("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("cart_items_user_id_food_id_key").on(table.userId, table.foodId),
  ],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  status: orderStatusEnum("status").default("PENDING").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentStatus: paymentStatusEnum("payment_status").default("UNPAID").notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  receiverName: varchar("receiver_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  address: text("address").notNull(),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  foodId: integer("food_id").references(() => foods.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  method: varchar("method", { length: 50 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: paymentTransactionStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  foodId: integer("food_id")
    .notNull()
    .references(() => foods.id),
  rating: integer("rating").notNull(),
  comment: varchar("comment", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: varchar("content", { length: 1000 }).notNull(),
  orderId: integer("order_id"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  discountType: discountTypeEnum("discount_type").default("PERCENT").notNull(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  maxDiscount: numeric("max_discount", { precision: 12, scale: 2 }),
  minOrderTotal: numeric("min_order_total", { precision: 12, scale: 2 }),
  scope: promotionScopeEnum("scope").default("GLOBAL").notNull(),
  targetIds: integer("target_ids").array().notNull().default([]),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  daysOfWeek: varchar("days_of_week", { length: 50 }),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  active: boolean("active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0).notNull(),
  randomCount: integer("random_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 100 }),
  sender: messageSenderEnum("sender").notNull(),
  content: varchar("content", { length: 4000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatbotKnowledge = pgTable("chatbot_knowledge", {
  id: serial("id").primaryKey(),
  title: text("title"),
  category: varchar("category", { length: 100 }),
  keywords: text("keywords"),
  content: text("content"),
  enabled: boolean("enabled").default(true).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size"),
  status: varchar("status", { length: 50 }).default("READY").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatbotKnowledgeChunk = pgTable("chatbot_knowledge_chunk", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiSetting = pgTable("ai_setting", {
  settingKey: varchar("setting_key", { length: 100 }).primaryKey(),
  settingValue: text("setting_value"),
});

// Infer types tien dung cho toan bo codebase
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatbotKnowledge = typeof chatbotKnowledge.$inferSelect;
export type ChatbotKnowledgeChunk = typeof chatbotKnowledgeChunk.$inferSelect;
export type AiSetting = typeof aiSetting.$inferSelect;
export type UserAddress = typeof userAddresses.$inferSelect;
