// Quan ly tai khoan khach hang: tao, sua, khoa, xoa khi chua co don hang.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { asc, count, desc, eq } from "drizzle-orm";
import {
  aiSetting,
  cartItems,
  chatMessages,
  notifications,
  orders,
  promotions,
  reviews,
  userAddresses,
  users,
} from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { toUserJson } from "../../lib/serializers.js";
import { env } from "../../config/env.js";


// ----- Khach hang (UC13) -----

export const listUsers = async () => {
  const userList = await db.query.users.findMany({ orderBy: [asc(users.id)] });
  return userList.map(toUserJson);
};

export const adminCreateUser = async (req: {
  email: string;
  password?: string | "";
  fullName: string;
  phone?: string | "";
  address?: string;
}) => {
  const exists = await db.query.users.findFirst({
    where: eq(users.email, req.email),
    columns: { id: true },
  });
  if (exists) throw badRequest("Email đã tồn tại");
  if (!req.password) throw badRequest("Mật khẩu không được để trống");

  const [user] = await db
    .insert(users)
    .values({
      email: req.email,
      password: await hashPassword(req.password),
      fullName: req.fullName,
      phone: req.phone || null,
      address: req.address ?? null,
      role: "CUSTOMER",
    })
    .returning();

  return toUserJson(user!);
};

export const adminUpdateUser = async (
  id: number,
  req: { email: string; password?: string | ""; fullName: string; phone?: string | ""; address?: string },
) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.email !== req.email) {
    const exists = await db.query.users.findFirst({
      where: eq(users.email, req.email),
      columns: { id: true },
    });
    if (exists) throw badRequest("Email đã tồn tại");
  }

  const [updated] = await db
    .update(users)
    .set({
      email: req.email,
      fullName: req.fullName,
      phone: req.phone || null,
      address: req.address ?? null,
      ...(req.password ? { password: await hashPassword(req.password) } : {}),
    })
    .where(eq(users.id, id))
    .returning();

  return toUserJson(updated!);
};

/** Khoa hoac xoa tai khoan quan tri se lam mat quyen truy cap he thong nen bi chan. */
export const setUserActive = async (id: number, active: boolean) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.role === "ADMIN") throw badRequest("Không thể thao tác trên tài khoản quản trị");

  const [updated] = await db
    .update(users)
    .set({ active })
    .where(eq(users.id, id))
    .returning();

  return toUserJson(updated!);
};

export const adminDeleteUser = async (id: number) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.role === "ADMIN") throw badRequest("Không thể thao tác trên tài khoản quản trị");

  const [orderRows, reviewRows] = await Promise.all([
    db.select({ value: count() }).from(orders).where(eq(orders.userId, id)),
    db.select({ value: count() }).from(reviews).where(eq(reviews.userId, id)),
  ]);

  const orderCount = orderRows[0]?.value ?? 0;
  const reviewCount = reviewRows[0]?.value ?? 0;

  if (orderCount > 0 || reviewCount > 0) {
    const parts: string[] = [];
    if (orderCount > 0) parts.push(`${orderCount} đơn hàng`);
    if (reviewCount > 0) parts.push(`${reviewCount} đánh giá`);
    throw conflict(`Không xoá được: khách đã có ${parts.join(" và ")}. Hãy khoá tài khoản để giữ lịch sử.`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.userId, id));
    await tx.delete(chatMessages).where(eq(chatMessages.userId, id));
    await tx.delete(notifications).where(eq(notifications.userId, id));
    await tx.delete(userAddresses).where(eq(userAddresses.userId, id));
    await tx.delete(users).where(eq(users.id, id));
  });
};
