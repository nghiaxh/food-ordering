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
import { markUsed, priceOrder, type DbClient } from "../../user/pricing/service.js";
import {
  canEditItems,
  isValidTransition,
  ORDER_STATUS_LABEL,
  parseStatus,
  type OrderStatus,
} from "../../user/order/transitions.js";
import { adminOrderSchema } from "./schema.js";
import { ORDER_WITH, fillItems, transition, updatePayment, trimNote, notify } from "../../user/order/service.js";
import type { z } from "zod";

type AdminOrderRequest = z.infer<typeof adminOrderSchema>;


// Nghiep vu don hang: tao don (gia tu DB), vong doi trang thai mot chieu, thanh toan gia lap COD/QR.
export const updatePaymentStatus = (
  order: { id: number; user?: { id: number } | null; userId?: number; paymentStatus: string },
  paid: boolean,
  client: DbClient = db,
) => updatePayment(order, paid, client);

/** Hoan doi trang thai trong admin: transition mot chieu + thong bao cho khach theo dung noi dung. */
export async function adminUpdateStatus(id: number, status: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  if (!order) throw notFound("Không tìm thấy đơn");
  const next = parseStatus(status);
  const draft = {
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  };
  transition(draft, next);

  const content =
    next === "CONFIRMED"
      ? `Đơn hàng #${id} đã được xác nhận.`
      : next === "PREPARING"
        ? `Đơn hàng #${id} đang được vận chuyển.`
        : next === "COMPLETED"
          ? `Đơn hàng #${id} đã hoàn thành. Cảm ơn bạn đã đặt món!`
          : next === "CANCELLED"
            ? `Đơn hàng #${id} đã bị hủy. Liên hệ hotline nếu bạn cần hỗ trợ.`
            : null;

  const saved = await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: next })
      .where(eq(orders.id, id));

    if (content) await notify(tx, order, content);

    return tx.query.orders.findFirst({
      where: eq(orders.id, id),
      with: ORDER_WITH,
    });
  });
  return toOrderJson(saved!);
}

// Quan tri: tao, sua, xoa don thay khach (UC12)

export async function adminCreateOrder(req: AdminOrderRequest) {
  if (!req.items || req.items.length === 0) {
    throw badRequest("Đơn phải có ít nhất một món");
  }
  const user = await db.query.users.findFirst({ where: eq(users.email, req.customerEmail) });
  if (!user) throw badRequest("Khách hàng không tồn tại");

  const order = await db.transaction(async (tx) => {
    const { items, priced } = await fillItems(tx, req.items!);
    let status = "PENDING" as OrderStatus;
    const paid = req.paid === true;
    if (req.status && req.status.trim()) {
      status = parseStatus(req.status.trim());
      // Tao thang sau buoc cho xac nhan voi QR thi phai da thu tien, nhu duong duyet don.
      if (status !== "PENDING" && status !== "CANCELLED" && req.paymentMethod === "QR" && !paid) {
        throw badRequest("Đơn chưa thanh toán nên chưa thể xác nhận");
      }
    }
    const [created] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        receiverName: req.receiverName,
        phone: req.phone,
        address: req.address,
        paymentMethod: req.paymentMethod,
        note: trimNote(req.note),
        status,
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

    await markUsed(priced.appliedPromotions, tx);
    await tx.insert(paymentTransactions).values({
      orderId: created.id,
      method: created.paymentMethod,
      amount: String(created.total),
    });

    if (paid) {
      await tx.update(orders).set({ paymentStatus: "PAID" }).where(eq(orders.id, created.id));
      await tx
        .update(paymentTransactions)
        .set({ status: "PAID", paidAt: new Date() })
        .where(eq(paymentTransactions.orderId, created.id));
    }
    return created;
  });

  if (!order) throw new Error("Không thể tạo đơn hàng");
  const full = await db.query.orders.findFirst({ where: eq(orders.id, order.id), with: ORDER_WITH });
  return toOrderJson(full!);
}

export async function adminUpdateOrder(id: number, req: AdminOrderRequest) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  if (!order) throw notFound("Không tìm thấy đơn");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw badRequest(
      `Đơn đã ${order.status === "COMPLETED" ? "hoàn thành" : "hủy"} nên không sửa được nữa`,
    );
  }

  const order2 = await db.transaction(async (tx) => {
    const data: Record<string, unknown> = {
      receiverName: req.receiverName,
      phone: req.phone,
      address: req.address,
      paymentMethod: req.paymentMethod ?? order.paymentMethod,
      note: trimNote(req.note),
    };

    if (req.items && req.items.length > 0) {
      if (!canEditItems(order)) {
        throw badRequest("Chỉ sửa được món khi đơn đang chờ xác nhận và chưa thanh toán");
      }
      const { items, priced } = await fillItems(tx, req.items);
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      await tx
        .update(orders)
        .set({
          ...data,
          total: String(priced.total),
          discountTotal: String(priced.discountTotal),
        })
        .where(eq(orders.id, id));

      await tx.insert(orderItems).values(
        items.map((it) => ({
          orderId: id,
          foodId: it.foodId,
          quantity: it.quantity,
          price: String(it.price),
          discountAmount: String(it.discountAmount),
        })),
      );

      await markUsed(priced.appliedPromotions, tx);
      await tx
        .update(paymentTransactions)
        .set({ amount: String(priced.total) })
        .where(eq(paymentTransactions.orderId, id));
    } else {
      await tx.update(orders).set(data).where(eq(orders.id, id));
    }

    if (req.status && req.status.trim()) {
      const next = parseStatus(req.status.trim());
      if (next !== order.status) {
        const current = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
        if (!current) throw notFound("Không tìm thấy đơn");
        const draft = {
          status: current.status,
          paymentMethod: current.paymentMethod,
          paymentStatus: current.paymentStatus,
        };
        transition(draft, next);
        await tx.update(orders).set({ status: next }).where(eq(orders.id, id));

        const content =
          next === "CONFIRMED"
            ? `Đơn hàng #${id} đã được xác nhận.`
            : next === "PREPARING"
              ? `Đơn hàng #${id} đang được vận chuyển.`
              : next === "COMPLETED"
                ? `Đơn hàng #${id} đã hoàn thành. Cảm ơn bạn đã đặt món!`
                : next === "CANCELLED"
                  ? `Đơn hàng #${id} đã bị hủy. Liên hệ hotline nếu bạn cần hỗ trợ.`
                  : null;
        if (content) {
          const withUser = await tx.query.orders.findFirst({
            where: eq(orders.id, id),
            with: { user: true },
          });
          if (withUser) await notify(tx, withUser, content);
        }
      }
    }

    if (req.paid != null) {
      const current = await tx.query.orders.findFirst({
        where: eq(orders.id, id),
        with: { user: true },
      });
      if (current && req.paid !== (current.paymentStatus === "PAID")) {
        await updatePayment(current, req.paid, tx);
      }
    }

    return tx.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  });

  return toOrderJson(order2!);
}

export async function adminDeleteOrder(id: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) throw notFound("Không tìm thấy đơn");
  await db.delete(paymentTransactions).where(eq(paymentTransactions.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
}

export async function adminListOrders() {
  const orderList = await db.query.orders.findMany({
    with: ORDER_WITH,
    orderBy: [desc(orders.createdAt)],
  });
  return orderList.map(toOrderJson);
}

export async function adminGetOrder(id: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: ORDER_WITH });
  if (!order) throw notFound("Không tìm thấy đơn");
  return {
    id: order.id,
    user: order.user ? { id: order.user.id } : { id: order.userId },
    paymentStatus: order.paymentStatus,
  };
}
