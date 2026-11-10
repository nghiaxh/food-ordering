// Nghiệp vụ đơn hàng: tạo đơn (giá từ DB), vòng đời trạng thái một chiều, thanh toán
// giả lập COD/QR, và các entry point cho quản trị (admin routes mount ở branch sau).

import type { OrderStatus, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { toOrderJson } from "../../lib/serializers.js";
import { markUsed, priceOrder, type DbClient } from "../pricing/service.js";
import {
  canEditItems,
  isValidTransition,
  ORDER_STATUS_LABEL,
  parseStatus,
} from "./transitions.js";
import type { createOrderSchema, adminOrderSchema } from "./schema.js";
import type { z } from "zod";

export { canEditItems, isValidTransition, ORDER_STATUS_LABEL, parseStatus };

type CreateOrderRequest = z.infer<typeof createOrderSchema>;
type AdminOrderRequest = z.infer<typeof adminOrderSchema>;

const ORDER_INCLUDE = {
  items: { include: { food: { include: { category: true } } } },
  user: true,
} as const;

const trimNote = (note?: string | null): string | null => {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
};

/** Chuyển trạng thái có kèm luật nghiệp vụ (QR phải đã thu tiền mới được xác nhận). */
function transition(order: { status: OrderStatus; paymentMethod: string | null; paymentStatus: string }, next: OrderStatus) {
  if (!isValidTransition(order.status, next)) {
    throw badRequest(`Không thể chuyển đơn từ "${ORDER_STATUS_LABEL[order.status]}" sang "${ORDER_STATUS_LABEL[next]}"`);
  }
  // QR thanh toán trước nên phải đã thu tiền mới xác nhận được; COD thu khi giao nên duyệt bình thường.
  if (next === "CONFIRMED" && order.paymentMethod === "QR" && order.paymentStatus !== "PAID") {
    throw badRequest("Đơn chưa thanh toán nên chưa thể xác nhận");
  }
  order.status = next;
}

async function requireSellable(items: Array<{ foodId: number }>, db: DbClient) {
  for (const item of items) {
    const food = await db.food.findUnique({ where: { id: item.foodId } });
    if (!food) throw badRequest("Món không tồn tại");
    if (!food.available) throw badRequest(`Món "${food.name}" đã ngừng phục vụ`);
  }
}

/** Chụp lại đơn từ DB; giá và giảm giá từng dòng do modules/pricing tính → khớp báo giá khách thấy. */
async function fillItems(
  tx: Prisma.TransactionClient,
  items: Array<{ foodId: number; quantity: number }>,
) {
  await requireSellable(items, tx);
  const priced = await priceOrder(items, tx);
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

const notify = async (
  tx: DbClient,
  order: { id: number; user: { id: number } },
  content: string,
) => {
  await tx.notification.create({
    data: { userId: order.user.id, orderId: order.id, content },
  });
};

export async function createOrder(email: string, req: CreateOrderRequest) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw badRequest("Phiên đăng nhập không hợp lệ");

  const order = await prisma.$transaction(async (tx) => {
    const { items, priced } = await fillItems(tx, req.items);
    const created = await tx.order.create({
      data: {
        userId: user.id,
        receiverName: req.receiverName,
        phone: req.phone,
        address: req.address,
        paymentMethod: req.paymentMethod,
        note: trimNote(req.note),
        total: priced.total,
        discountTotal: priced.discountTotal,
        items: { create: items },
      },
      include: ORDER_INCLUDE,
    });
    // Lượt dùng khuyến mãi chỉ bị trừ trong cùng transaction với việc tạo đơn.
    await markUsed(priced.appliedPromotions, tx);
    await tx.paymentTransaction.create({
      data: { orderId: created.id, method: created.paymentMethod, amount: created.total },
    });
    await notify(
      tx,
      created,
      `Đơn hàng #${created.id} đã được tạo. Chúng tôi sẽ sớm xác nhận đơn của bạn.`,
    );
    return created;
  });
  return toOrderJson(order);
}

export async function myOrders(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(toOrderJson);
}

/** Khách chỉ tự hủy được đơn còn chờ xác nhận; quán đã vào chế biến thì phải gọi hotline. */
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
  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
      include: ORDER_INCLUDE,
    });
    await notify(tx, updated, `Đơn hàng #${id} đã được hủy theo yêu cầu của bạn.`);
    return updated;
  });
  return toOrderJson(saved);
}

/** Thanh toán giả lập: khách tự xác nhận đã trả, hệ thống chỉ ghi nhận trạng thái. */
export async function payOrder(email: string, id: number) {
  const order = await ownOrder(email, id);
  if (order.status === "CANCELLED") {
    throw badRequest("Đơn đã hủy thì không thanh toán được");
  }
  const updated = await updatePayment(order, true);
  return toOrderJson(updated);
}

export const updatePaymentStatus = (
  order: { id: number; user: { id: number }; paymentStatus: string },
  paid: boolean,
  db: DbClient = prisma,
) => updatePayment(order, paid, db);

/** Đồng bộ trạng thái thanh toán của đơn với giao dịch tương ứng; gửi thông báo (trong cùng transaction). */
async function applyPaymentTx(
  tx: DbClient,
  order: { id: number; user: { id: number }; paymentStatus: string },
  paid: boolean,
) {
  const next = paid ? "PAID" : "UNPAID";
  const updated = await tx.order.update({
    where: { id: order.id },
    data: { paymentStatus: next },
    include: ORDER_INCLUDE,
  });
  await tx.paymentTransaction.updateMany({
    where: { orderId: order.id },
    data: paid ? { status: "PAID", paidAt: new Date() } : { status: "PENDING", paidAt: null },
  });
  await notify(
    tx,
    updated,
    paid
      ? `Đơn hàng #${order.id} đã được ghi nhận thanh toán.`
      : `Đơn hàng #${order.id} chuyển về trạng thái chưa thanh toán.`,
  );
  return updated;
}

async function updatePayment(
  order: { id: number; user: { id: number }; paymentStatus: string },
  paid: boolean,
  db: DbClient = prisma,
) {
  const next = paid ? "PAID" : "UNPAID";
  if (order.paymentStatus === next) {
    return db.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  }
  // Bên ngoài một transaction thì mở transaction mới; bên trong (adminUpdate) thì dùng chung.
  if (db !== prisma) {
    return applyPaymentTx(db, order, paid);
  }
  return prisma.$transaction((tx) => applyPaymentTx(tx, order, paid));
}

/** Chặn việc khách đọc hoặc thao tác lên đơn của người khác. */
async function ownOrder(email: string, id: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw notFound("Không tìm thấy đơn");
  if (order.userId !== user.id) {
    throw forbidden("Bạn không có quyền với đơn hàng này");
  }
  return order;
}

// ----- Quản trị: tạo, sửa, xoá đơn thay khách (UC12) — route mount ở branch admin -----

export async function adminCreateOrder(req: AdminOrderRequest) {
  if (!req.items || req.items.length === 0) {
    throw badRequest("Đơn phải có ít nhất một món");
  }
  const user = await prisma.user.findUnique({ where: { email: req.customerEmail } });
  if (!user) throw badRequest("Khách hàng không tồn tại");

  const order = await prisma.$transaction(async (tx) => {
    const { items, priced } = await fillItems(tx, req.items!);
    let status = "PENDING" as OrderStatus;
    const paid = req.paid === true;
    if (req.status && req.status.trim()) {
      status = parseStatus(req.status.trim());
      // Tạo thẳng sau bước chờ xác nhận với QR thì phải đã thu tiền, như đường duyệt đơn.
      if (status !== "PENDING" && status !== "CANCELLED" && req.paymentMethod === "QR" && !paid) {
        throw badRequest("Đơn chưa thanh toán nên chưa thể xác nhận");
      }
    }
    const created = await tx.order.create({
      data: {
        userId: user.id,
        receiverName: req.receiverName,
        phone: req.phone,
        address: req.address,
        paymentMethod: req.paymentMethod,
        note: trimNote(req.note),
        status,
        total: priced.total,
        discountTotal: priced.discountTotal,
        items: { create: items },
      },
      include: ORDER_INCLUDE,
    });
    await markUsed(priced.appliedPromotions, tx);
    await tx.paymentTransaction.create({
      data: { orderId: created.id, method: created.paymentMethod, amount: created.total },
    });
    if (paid) {
      await tx.order.update({ where: { id: created.id }, data: { paymentStatus: "PAID" } });
      await tx.paymentTransaction.updateMany({
        where: { orderId: created.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    return created;
  });
  const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  return toOrderJson(full);
}

export async function adminUpdateOrder(id: number, req: AdminOrderRequest) {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw notFound("Không tìm thấy đơn");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw badRequest(
      `Đơn đã ${order.status === "COMPLETED" ? "hoàn thành" : "hủy"} nên không sửa được nữa`,
    );
  }

  const order2 = await prisma.$transaction(async (tx) => {
    const data: Prisma.OrderUpdateInput = {
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
      // orphanRemoval: xoá dòng cũ khi thay cả danh sách món của đơn.
      const { items, priced } = await fillItems(tx, req.items);
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.update({
        where: { id },
        data: { ...data, total: priced.total, discountTotal: priced.discountTotal,
          items: { create: items } },
      });
      await markUsed(priced.appliedPromotions, tx);
      await tx.paymentTransaction.updateMany({
        where: { orderId: id },
        data: { amount: priced.total },
      });
    } else {
      await tx.order.update({ where: { id }, data });
    }

    if (req.status && req.status.trim()) {
      const next = parseStatus(req.status.trim());
      if (next !== order.status) {
        const current = await tx.order.findUniqueOrThrow({ where: { id } });
        const draft = {
          status: current.status,
          paymentMethod: current.paymentMethod,
          paymentStatus: current.paymentStatus,
        };
        transition(draft, next);
        await tx.order.update({ where: { id }, data: { status: next } });
        // Thông báo trạng thái cho khách theo đúng nội dung nghiệp vụ.
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
          const withUser = await tx.order.findUniqueOrThrow({ where: { id }, include: { user: true } });
          await notify(tx, withUser, content);
        }
      }
    }

    // `paid` truyền từ admin: ghi đè trạng thái thanh toán và đồng bộ với giao dịch.
    if (req.paid != null) {
      const current = await tx.order.findUniqueOrThrow({ where: { id }, include: { user: true } });
      if (req.paid !== (current.paymentStatus === "PAID")) {
        await updatePayment(current, req.paid, tx);
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
  });

  return toOrderJson(order2);
}

export async function adminDeleteOrder(id: number) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw notFound("Không tìm thấy đơn");
  await prisma.paymentTransaction.deleteMany({ where: { orderId: id } });
  await prisma.order.delete({ where: { id } });
}

export async function adminListOrders() {
  const orders = await prisma.order.findMany({
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(toOrderJson);
}
