import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { toCartItemJson } from "../../lib/serializers.js";
import { priceOrder, toQuote } from "../pricing/service.js";
import type { quoteRequestSchema } from "./schema.js";
import type { z } from "zod";

type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const FOOD_INCLUDE = { food: { include: { category: true } } } as const;

export async function listCart(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const items = await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: FOOD_INCLUDE,
    orderBy: { id: "asc" },
  });
  return items.map(toCartItemJson);
}

export async function addToCart(email: string, foodId: number, quantity: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const food = await prisma.food.findUnique({ where: { id: foodId } });
  if (!food) throw badRequest("Món không tồn tại");
  if (!food.available) {
    throw badRequest(`Món "${food.name}" hiện không phục vụ`);
  }
  // Dòng mới bắt đầu từ 0 rồi cộng quantity, vì entity mặc định 1 sẽ làm lần thêm đầu dư 1 phần.
  const item = await prisma.cartItem.upsert({
    where: { userId_foodId: { userId: user.id, foodId } },
    create: { userId: user.id, foodId, quantity: 0 },
    update: {},
    include: FOOD_INCLUDE,
  });
  const saved = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: { increment: quantity } },
    include: FOOD_INCLUDE,
  });
  return toCartItemJson(saved);
}

export async function updateCartItem(email: string, foodId: number, quantity: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const item = await prisma.cartItem.findUnique({
    where: { userId_foodId: { userId: user.id, foodId } },
  });
  if (!item) throw notFound("Món chưa có trong giỏ hàng");
  const saved = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity },
    include: FOOD_INCLUDE,
  });
  return toCartItemJson(saved);
}

export async function removeCartItem(email: string, foodId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const item = await prisma.cartItem.findUnique({
    where: { userId_foodId: { userId: user.id, foodId } },
  });
  if (!item) throw notFound("Món chưa có trong giỏ hàng");
  await prisma.cartItem.delete({ where: { id: item.id } });
}

export async function clearCart(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.cartItem.deleteMany({ where: { userId: user.id } });
}

export async function quote(items: QuoteRequest["items"]) {
  return toQuote(await priceOrder(items));
}
