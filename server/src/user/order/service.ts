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
      `Không thể chuyển đơn từ "${ORDER_STATUS_LABEL[order.status]}" sang "${ORDER_STATUS_LABEL[next]}"`,
    );
  }
  // QR thanh toan truoc nen phai da thu tien moi xac nhan duoc; COD thu khi giao nen duyet binh thuong.
  if (next === "CONFIRMED" && order.paymentMethod === "QR" && order.paymentStatus !== "PAID") {
    throw badRequest("Đơn chưa thanh toán nên chưa thể xác nhận");
  }
  order.status = next;
}

async function requireSellable(items: Array<{ foodId: number }>, client: DbClient) {
  for (const item of items) {
    const food = await client.query.foods.findFirst({ where: eq(foods.id, item.foodId) });
    if (!food) throw badRequest("Món không tồn tại");
    if (!food.available) throw badRequest(`Món "${food.name}" đã ngừng phục vụ`);
  }
}

/** Chup lai don tu DB; gia va giam gia tung dong do user/pricing tinh → khop bao gia khach thay. */
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
  if (!user) throw badRequest("Phiên đăng nhập không hợp lệ");

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
    if (!created) throw new Error("Không thể tạo đơn hàng");

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
      `Đơn hàng #${created.id} đã được tạo. Chúng tôi sẽ sớm xác nhận đơn của bạn.`,
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
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");

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
    throw badRequest("Chỉ đơn đang chờ xác nhận mới hủy được. Vui lòng liên hệ hotline.");
  }
  if (order.paymentStatus === "PAID") {
    throw badRequest(
      "Đơn hàng đã thanh toán không thể tự hủy trên hệ thống. Vui lòng liên hệ hotline quán để được hỗ trợ hoàn tiền.",
    );
  }
  const saved = await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "CANCELLED" })
      .where(eq(orders.id, order.id));

    await notify(tx, order, `Đơn hàng #${id} đã được hủy theo yêu cầu của bạn.`);

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
      ? `Đơn hàng #${order.id} đã được ghi nhận thanh toán.`
      : `Đơn hàng #${order.id} chuyển về trạng thái chưa thanh toán.`,
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
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  if (!order) throw notFound("Không tìm thấy đơn");
  if (order.userId !== user.id) {
    throw forbidden("Bạn không có quyền với đơn hàng này");
  }
  return order;
}
