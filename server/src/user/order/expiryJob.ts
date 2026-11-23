import { and, eq, lte } from "drizzle-orm";
import { env } from "../../config/env.js";
import { notifications, orders } from "../../db/schema.js";
import { db } from "../../lib/db.js";

const TIMEOUT_MINUTES = env.ORDER_PAYMENT_TIMEOUT_MINUTES;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

export async function sweepExpiredOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - TIMEOUT_MS);
  return db.transaction(async (tx) => {
    const cancelled = await tx
      .update(orders)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(orders.status, "PENDING"),
          eq(orders.paymentStatus, "UNPAID"),
          eq(orders.paymentMethod, "QR"),
          lte(orders.createdAt, cutoff),
        ),
      )
      .returning({ id: orders.id, userId: orders.userId });

    if (cancelled.length > 0) {
      await tx.insert(notifications).values(
        cancelled.map((order) => ({
          userId: order.userId,
          orderId: order.id,
          content: `Đơn hàng #${order.id} đã tự động hủy vì quá ${TIMEOUT_MINUTES} phút chưa thanh toán.`,
        })),
      );
    }
    return cancelled.length;
  });
}

/** Quet ngay khi khoi dong roi moi 60s; loi DB chi ghi log de server van phuc vu binh thuong. */
export function startOrderExpirySweeper() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const count = await sweepExpiredOrders();
      if (count > 0) console.log(`Da tu huy ${count} don QR qua han thanh toan`);
    } catch (err) {
      console.error("Khong quet duoc don qua han thanh toan:", err);
    } finally {
      running = false;
    }
  };
  void run();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
