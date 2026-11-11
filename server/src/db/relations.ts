import { relations } from "drizzle-orm";
import {
  users,
  userAddresses,
  categories,
  foods,
  cartItems,
  orders,
  orderItems,
  paymentTransactions,
  reviews,
  notifications,
  chatMessages,
  chatbotKnowledge,
  chatbotKnowledgeChunk,
} from "./schema.js";

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  reviews: many(reviews),
  cartItems: many(cartItems),
  notifications: many(notifications),
  chatMessages: many(chatMessages),
  addresses: many(userAddresses),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  foods: many(foods),
}));

export const foodsRelations = relations(foods, ({ one, many }) => ({
  category: one(categories, {
    fields: [foods.categoryId],
    references: [categories.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  reviews: many(reviews),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  food: one(foods, {
    fields: [cartItems.foodId],
    references: [foods.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payment: one(paymentTransactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  food: one(foods, {
    fields: [orderItems.foodId],
    references: [foods.id],
  }),
}));

export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one }) => ({
    order: one(orders, {
      fields: [paymentTransactions.orderId],
      references: [orders.id],
    }),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  food: one(foods, {
    fields: [reviews.foodId],
    references: [foods.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const chatbotKnowledgeRelations = relations(
  chatbotKnowledge,
  ({ many }) => ({
    chunks: many(chatbotKnowledgeChunk),
  }),
);

export const chatbotKnowledgeChunkRelations = relations(
  chatbotKnowledgeChunk,
  ({ one }) => ({
    knowledge: one(chatbotKnowledge, {
      fields: [chatbotKnowledgeChunk.documentId],
      references: [chatbotKnowledge.id],
    }),
  }),
);
