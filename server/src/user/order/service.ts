// Nghiep vu don hang: tao don (gia tu DB), vong doi trang thai mot chieu, thanh toan
// gia lap COD/QR, va cac entry point cho quan tri.

import { desc, eq } from "drizzle-orm";
import {
  foods,
  notifications,
  orderItems,
  orders,
  paymentTransactions,
  users,
} from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../lib/errors.js";
import { toOrderJson } from "../../lib/serializers.js";
import { markUsed, priceOrder, type DbClient } from "../pricing/service.js";
import {
  canEditItems,
  isValidTransition,
  ORDER_STATUS_LABEL,
  parseStatus,
  type OrderStatus,
} from "./transitions.js";
import type { createOrderSchema } from "./schema.js";
import type { z } from "zod";

export { canEditItems, isValidTransition, ORDER_STATUS_LABEL, parseStatus };

type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export const ORDER_WITH = {
  items: { with: { food: { with: { category: true } } } },
  user: true,
} as const;

export const trimNote = (note?: string | null): string | null => {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
};

/** Chuyen trang thai co kem luat nghiep vu (QR phai da thu tien moi duoc xac nhan). */
export function transition(
  order: { status: OrderStatus; paymentMethod: string | null; paymentStatus: string },
  next: OrderStatus,
) {
  if (!isValidTransition(order.status, next)) {
    throw badRequest(
      `Kh├┤ng thß╗â chuyß╗ân ─æ╞ín tß╗½ "${ORDER_STATUS_LABEL[order.status]}" sang "${ORDER_STATUS_LABEL[next]}"`,
    );
  }
  // QR thanh toan truoc nen phai da thu tien moi xac nhan duoc; COD thu khi giao nen duyet binh thuong.
  if (next === "CONFIRMED" && order.paymentMethod === "QR" && order.paymentStatus !== "PAID") {
    throw badRequest("─É╞ín ch╞░a thanh to├ín n├¬n ch╞░a thß╗â x├íc nhß║¡n");
  }
  order.status = next;
}

async function requireSellable(items: Array<{ foodId: number }>, client: DbClient) {
  for (const item of items) {
    const food = await client.query.foods.findFirst({ where: eq(foods.id, item.foodId) });
    if (!food) throw badRequest("M├│n kh├┤ng tß╗ôn tß║íi");
    if (!food.available) throw badRequest(`M├│n "${food.name}" ─æ├ú ngß╗½ng phß╗Ñc vß╗Ñ`);
  }
}

/** Chup lai don tu DB; gia va giam gia tung dong do user/pricing tinh ΓåÆ khop bao gia khach thay. */
export async function fillItems(
  client: DbClient,
  items: Array<{ foodId: number; quantity: number }>,
) {
  await requireSellable(items, client);
  const priced = await priceOrder(items, client);
  const created: Array<{ foodId: number; quantity: number; price: number; discountAmount: number }> = [];
  for (const line of priced.lines) {
    created.push({
      foodId: line.food.id,
      quantity: line.quantity,
      price: line.unitPrice,
      discountAmount: line.lineDiscount,
    });
  }
  return { items: created, priced };
}

export const notify = async (
  client: DbClient,
  order: { id: number; user?: { id: number } | null; userId?: number },
  content: string,
) => {
  const targetUserId = order.user?.id ?? order.userId;
  if (!targetUserId) return;
  await client.insert(notifications).values({
    userId: targetUserId,
    orderId: order.id,
    content,
  });
};

export async function createOrder(email: string, req: CreateOrderRequest) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw badRequest("Phi├¬n ─æ─âng nhß║¡p kh├┤ng hß╗úp lß╗ç");

  const createdOrder = await db.transaction(async (tx) => {
    const { items, priced } = await fillItems(tx, req.items);
    const [created] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        receiverName: req.receiverName,
        phone: req.phone,
        address: req.address,
        paymentMethod: req.paymentMethod,
        note: trimNote(req.note),
        total: String(priced.total),
        discountTotal: String(priced.discountTotal),
      })
      .returning();
    if (!created) throw new Error("Kh├┤ng thß╗â tß║ío ─æ╞ín h├áng");

    if (items.length > 0) {
      await tx.insert(orderItems).values(
        items.map((it) => ({
          orderId: created.id,
          foodId: it.foodId,
          quantity: it.quantity,
          price: String(it.price),
          discountAmount: String(it.discountAmount),
        })),
      );
    }

    // Luot dung khuyen mai chi bi tru trong cung transaction voi viec tao don.
    await markUsed(priced.appliedPromotions, tx);
    await tx.insert(paymentTransactions).values({
      orderId: created.id,
      method: created.paymentMethod,
      amount: String(created.total),
    });
    await notify(
      tx,
      { id: created.id, userId: user.id },
      `─É╞ín h├áng #${created.id} ─æ├ú ─æ╞░ß╗úc tß║ío. Ch├║ng t├┤i sß║╜ sß╗¢m x├íc nhß║¡n ─æ╞ín cß╗ºa bß║ín.`,
    );

    return tx.query.orders.findFirst({
      where: eq(orders.id, created.id),
      with: ORDER_WITH,
    });
  });

  return toOrderJson(createdOrder!);
}

export async function myOrders(email: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phi├¬n ─æ─âng nhß║¡p kh├┤ng hß╗úp lß╗ç");

  const orderList = await db.query.orders.findMany({
    where: eq(orders.userId, user.id),
    with: ORDER_WITH,
    orderBy: [desc(orders.createdAt)],
  });
  return orderList.map(toOrderJson);
}

/** Khach chi tu huy duoc don con cho xac nhan; quan da vao che bien thi phai goi hotline. */
export async function cancelOrder(email: string, id: number) {
  const order = await ownOrder(email, id);
  if (order.status !== "PENDING") {
    throw badRequest("Chß╗ë ─æ╞ín ─æang chß╗¥ x├íc nhß║¡n mß╗¢i hß╗ºy ─æ╞░ß╗úc. Vui l├▓ng li├¬n hß╗ç hotline.");
  }
  if (order.paymentStatus === "PAID") {
    throw badRequest(
      "─É╞ín h├áng ─æ├ú thanh to├ín kh├┤ng thß╗â tß╗▒ hß╗ºy tr├¬n hß╗ç thß╗æng. Vui l├▓ng li├¬n hß╗ç hotline qu├ín ─æß╗â ─æ╞░ß╗úc hß╗ù trß╗ú ho├án tiß╗ün.",
    );
  }
  const saved = await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "CANCELLED" })
      .where(eq(orders.id, order.id));

    await notify(tx, order, `─É╞ín h├áng #${id} ─æ├ú ─æ╞░ß╗úc hß╗ºy theo y├¬u cß║ºu cß╗ºa bß║ín.`);

    return tx.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: ORDER_WITH,
    });
  });
  return toOrderJson(saved!);
}




/** Dong bo trang thai thanh toan cua don voi giao dich tuong ung; gui thong bao (trong cung transaction). */
async function applyPaymentTx(
  tx: DbClient,
  order: { id: number; user?: { id: number } | null; userId?: number; paymentStatus: string },
  paid: boolean,
) {
  const next = paid ? "PAID" : "UNPAID";
  await tx
    .update(orders)
    .set({ paymentStatus: next })
    .where(eq(orders.id, order.id));

  await tx
    .update(paymentTransactions)
    .set(paid ? { status: "PAID", paidAt: new Date() } : { status: "PENDING", paidAt: null })
    .where(eq(paymentTransactions.orderId, order.id));

  await notify(
    tx,
    order,
    paid
      ? `─É╞ín h├áng #${order.id} ─æ├ú ─æ╞░ß╗úc ghi nhß║¡n thanh to├ín.`
      : `─É╞ín h├áng #${order.id} chuyß╗ân vß╗ü trß║íng th├íi ch╞░a thanh to├ín.`,
  );

  const updated = await tx.query.orders.findFirst({
    where: eq(orders.id, order.id),
    with: ORDER_WITH,
  });
  return updated!;
}

export async function updatePayment(
  order: { id: number; user?: { id: number } | null; userId?: number; paymentStatus: string },
  paid: boolean,
  client: DbClient = db,
) {
  const next = paid ? "PAID" : "UNPAID";
  if (order.paymentStatus === next) {
    const existing = await client.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: ORDER_WITH,
    });
    return existing!;
  }
  if (client !== db) {
    return applyPaymentTx(client, order, paid);
  }
  return db.transaction((tx) => applyPaymentTx(tx, order, paid));
}

/** Chan viec khach doc hoac thao tac len don cua nguoi khac. */
export async function ownOrder(email: string, id: number) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phi├¬n ─æ─âng nhß║¡p kh├┤ng hß╗úp lß╗ç");

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  if (!order) throw notFound("Kh├┤ng t├¼m thß║Ñy ─æ╞ín");
  if (order.userId !== user.id) {
    throw forbidden("Bß║ín kh├┤ng c├│ quyß╗ün vß╗¢i ─æ╞ín h├áng n├áy");
  }
  return order;
}
