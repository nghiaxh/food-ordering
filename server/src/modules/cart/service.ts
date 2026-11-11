import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { cartItems, foods, users } from "../../db/schema.js";
import { badRequest, notFound, unauthorized } from "../../lib/errors.js";
import { toCartItemJson } from "../../lib/serializers.js";
import { priceOrder, toQuote } from "../pricing/service.js";
import type { quoteRequestSchema } from "./schema.js";
import type { z } from "zod";

type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const getUserOrThrow = async (email: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  return user;
};

export async function listCart(email: string) {
  const user = await getUserOrThrow(email);
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.userId, user.id),
    with: { food: { with: { category: true } } },
    orderBy: [asc(cartItems.id)],
  });
  return items.map(toCartItemJson);
}

export async function addToCart(email: string, foodId: number, quantity: number) {
  const user = await getUserOrThrow(email);
  const food = await db.query.foods.findFirst({ where: eq(foods.id, foodId) });
  if (!food) throw badRequest("Món không tồn tại");
  if (!food.available) {
    throw badRequest(`Món "${food.name}" hiện không phục vụ`);
  }

  // Dùng insert on conflict do update để cộng dồn quantity
  const [item] = await db
    .insert(cartItems)
    .values({ userId: user.id, foodId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.foodId],
      set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
    })
    .returning();

  const saved = await db.query.cartItems.findFirst({
    where: eq(cartItems.id, item!.id),
    with: { food: { with: { category: true } } },
  });
  return toCartItemJson(saved!);
}

export async function updateCartItem(email: string, foodId: number, quantity: number) {
  const user = await getUserOrThrow(email);
  const item = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, user.id), eq(cartItems.foodId, foodId)),
  });
  if (!item) throw notFound("Món chưa có trong giỏ hàng");

  await db
    .update(cartItems)
    .set({ quantity })
    .where(eq(cartItems.id, item.id));

  const saved = await db.query.cartItems.findFirst({
    where: eq(cartItems.id, item!.id),
    with: { food: { with: { category: true } } },
  });
  return toCartItemJson(saved!);
}

export async function removeCartItem(email: string, foodId: number) {
  const user = await getUserOrThrow(email);
  const item = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, user.id), eq(cartItems.foodId, foodId)),
  });
  if (!item) throw notFound("Món chưa có trong giỏ hàng");
  await db.delete(cartItems).where(eq(cartItems.id, item.id));
}

export async function clearCart(email: string) {
  const user = await getUserOrThrow(email);
  await db.delete(cartItems).where(eq(cartItems.userId, user.id));
}

export async function quote(items: QuoteRequest["items"]) {
  return toQuote(await priceOrder(items));
}
