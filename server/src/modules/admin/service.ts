// Nghiệp vụ quản trị: tài khoản khách, khuyến mãi, cấu hình AI, lịch sử hội thoại, upload ảnh.

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

// ----- Khách hàng (UC13) -----

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

/** Khóa hoặc xóa tài khoản quản trị sẽ làm mất quyền truy cập hệ thống nên bị chặn. */
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

// ----- Khuyến mãi -----

export const toPromotionJson = (p: {
  id: number;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: unknown;
  maxDiscount: unknown;
  scope: string;
  targetIds: number[];
  startsAt: Date;
  endsAt: Date;
  daysOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  priority: number;
  usageLimit: number | null;
  usedCount: number;
  randomCount: number;
}) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? undefined,
  discountType: p.discountType,
  discountValue: Number(p.discountValue),
  maxDiscount: p.maxDiscount == null ? null : Number(p.maxDiscount),
  scope: p.scope,
  targetIds: [...p.targetIds],
  startsAt: p.startsAt.toISOString(),
  endsAt: p.endsAt.toISOString(),
  daysOfWeek: p.daysOfWeek,
  startTime: p.startTime,
  endTime: p.endTime,
  active: p.active,
  priority: p.priority,
  usageLimit: p.usageLimit,
  usedCount: p.usedCount,
  randomCount: p.randomCount,
});

export const listPromotions = async () => {
  const rows = await db.query.promotions.findMany({ orderBy: [asc(promotions.id)] });
  return rows.map(toPromotionJson);
};

export const createPromotion = async (req: {
  name: string;
  description?: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  maxDiscount?: number | null;
  scope: "GLOBAL" | "CATEGORY" | "FOOD";
  targetIds?: number[];
  startsAt: Date;
  endsAt: Date;
  daysOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  active: boolean;
  priority: number;
  usageLimit?: number | null;
  randomCount: number;
}) => {
  const [created] = await db
    .insert(promotions)
    .values({
      name: req.name,
      description: req.description ?? null,
      discountType: req.discountType,
      discountValue: String(req.discountValue),
      maxDiscount: req.maxDiscount != null ? String(req.maxDiscount) : null,
      scope: req.scope,
      targetIds: req.targetIds ?? [],
      startsAt: req.startsAt,
      endsAt: req.endsAt,
      daysOfWeek: req.daysOfWeek?.trim() ? req.daysOfWeek.trim() : null,
      startTime: req.startTime ?? null,
      endTime: req.endTime ?? null,
      active: req.active,
      priority: req.priority,
      usageLimit: req.usageLimit ?? null,
      randomCount: req.randomCount,
    })
    .returning();

  return toPromotionJson(created!);
};

export const updatePromotion = async (
  id: number,
  req: Parameters<typeof createPromotion>[0],
) => {
  const exists = await db.query.promotions.findFirst({
    where: eq(promotions.id, id),
    columns: { id: true },
  });
  if (!exists) throw notFound("Không tìm thấy khuyến mãi");

  const [updated] = await db
    .update(promotions)
    .set({
      name: req.name,
      description: req.description ?? null,
      discountType: req.discountType,
      discountValue: String(req.discountValue),
      maxDiscount: req.maxDiscount != null ? String(req.maxDiscount) : null,
      scope: req.scope,
      targetIds: req.targetIds ?? [],
      startsAt: req.startsAt,
      endsAt: req.endsAt,
      daysOfWeek: req.daysOfWeek?.trim() ? req.daysOfWeek.trim() : null,
      startTime: req.startTime ?? null,
      endTime: req.endTime ?? null,
      active: req.active,
      priority: req.priority,
      usageLimit: req.usageLimit ?? null,
      randomCount: req.randomCount,
    })
    .where(eq(promotions.id, id))
    .returning();

  return toPromotionJson(updated!);
};

export const deletePromotion = async (id: number) => {
  const exists = await db.query.promotions.findFirst({
    where: eq(promotions.id, id),
    columns: { id: true },
  });
  if (!exists) throw notFound("Không tìm thấy khuyến mãi");
  await db.delete(promotions).where(eq(promotions.id, id));
};

// ----- Cấu hình AI / lịch sử hội thoại -----

export const listAiSettings = async () => {
  const rows = await db.query.aiSetting.findMany({ orderBy: [asc(aiSetting.settingKey)] });
  return rows.map((r) => ({ settingKey: r.settingKey, settingValue: r.settingValue }));
};

export const saveAiSetting = async (settingKey: string, settingValue: string) => {
  const key = settingKey.trim();
  if (!key) throw badRequest("settingKey không được để trống");

  const [row] = await db
    .insert(aiSetting)
    .values({ settingKey: key, settingValue })
    .onConflictDoUpdate({
      target: [aiSetting.settingKey],
      set: { settingValue },
    })
    .returning();

  return { settingKey: row!.settingKey, settingValue: row!.settingValue };
};

export const chatHistory = async () => {
  const rows = await db.query.chatMessages.findMany({
    orderBy: [desc(chatMessages.createdAt)],
    with: { user: true },
  });
  return rows.map((r) => ({
    id: r.id,
    user: r.user ? toUserJson(r.user) : null,
    sessionId: r.sessionId,
    sender: r.sender,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
};

// ----- Ảnh món ăn -----

/** Trả về phần mở rộng nếu 12 byte đầu khớp chữ ký JPEG, PNG hoặc WEBP. */
const imageExtension = (head: Buffer): string | null => {
  if (head[0] === 0xff && head[1] === 0xd8) return ".jpg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return ".png";
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return ".webp";
  }
  return null;
};

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const saveImage = async (buffer: Buffer, host: string, protocol: string) => {
  const ext = imageExtension(buffer.subarray(0, 12));
  if (!ext) throw badRequest("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
  const name = `${randomUUID()}${ext}`;
  writeFileSync(join(env.UPLOAD_DIR, name), buffer);
  return { url: `${protocol}://${host}/api/uploads/${name}`, mime: IMAGE_MIME[ext] };
};
