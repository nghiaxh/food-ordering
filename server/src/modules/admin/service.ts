// Nghiệp vụ quản trị: tài khoản khách, khuyến mãi, cấu hình AI, lịch sử hội thoại, upload ảnh.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { toUserJson } from "../../lib/serializers.js";
import { env } from "../../config/env.js";

// ----- Khách hàng (UC13) -----

export const listUsers = async () => {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return users.map(toUserJson);
};

export const adminCreateUser = async (req: {
  email: string;
  password?: string | "";
  fullName: string;
  phone?: string | "";
  address?: string;
}) => {
  const exists = await prisma.user.findUnique({ where: { email: req.email }, select: { id: true } });
  if (exists) throw badRequest("Email đã tồn tại");
  if (!req.password) throw badRequest("Mật khẩu không được để trống");
  const user = await prisma.user.create({
    data: {
      email: req.email,
      password: await hashPassword(req.password),
      fullName: req.fullName,
      phone: req.phone || null,
      address: req.address ?? null,
      // Tài khoản tạo từ trang quản trị luôn là khách hàng; admin do hệ thống cấp sẵn.
      role: "CUSTOMER",
    },
  });
  return toUserJson(user);
};

export const adminUpdateUser = async (
  id: number,
  req: { email: string; password?: string | ""; fullName: string; phone?: string | ""; address?: string },
) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.email !== req.email) {
    const exists = await prisma.user.findUnique({ where: { email: req.email }, select: { id: true } });
    if (exists) throw badRequest("Email đã tồn tại");
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      email: req.email,
      fullName: req.fullName,
      phone: req.phone || null,
      address: req.address ?? null,
      // Mật khẩu để trống nghĩa là giữ nguyên mật khẩu hiện tại.
      ...(req.password ? { password: await hashPassword(req.password) } : {}),
    },
  });
  return toUserJson(updated);
};

/** Khóa hoặc xóa tài khoản quản trị sẽ làm mất quyền truy cập hệ thống nên bị chặn. */
export const setUserActive = async (id: number, active: boolean) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.role === "ADMIN") throw badRequest("Không thể thao tác trên tài khoản quản trị");
  const updated = await prisma.user.update({ where: { id }, data: { active } });
  return toUserJson(updated);
};

export const adminDeleteUser = async (id: number) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("Không tìm thấy tài khoản");
  if (user.role === "ADMIN") throw badRequest("Không thể thao tác trên tài khoản quản trị");

  // Đơn và đánh giá đều giữ khoá ngoại tới users; xóa user khi còn các bản ghi đó
  // sẽ làm hỏng lịch sử đơn hàng, nên chặn trước và trả 409.
  const [orders, reviews] = await Promise.all([
    prisma.order.count({ where: { userId: id } }),
    prisma.review.count({ where: { userId: id } }),
  ]);
  if (orders > 0 || reviews > 0) {
    const parts: string[] = [];
    if (orders > 0) parts.push(`${orders} đơn hàng`);
    if (reviews > 0) parts.push(`${reviews} đánh giá`);
    throw conflict(`Không xoá được: khách đã có ${parts.join(" và ")}. Hãy khoá tài khoản để giữ lịch sử.`);
  }
  // Giỏ, thông báo và tin nhắn chatbot là dữ liệu phụ nên xoá theo tài khoản.
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { userId: id } }),
    prisma.chatMessage.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
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
  const rows = await prisma.promotion.findMany({ orderBy: { id: "asc" } });
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
  const created = await prisma.promotion.create({
    data: {
      name: req.name,
      description: req.description ?? null,
      discountType: req.discountType,
      discountValue: req.discountValue,
      maxDiscount: req.maxDiscount ?? null,
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
    },
  });
  return toPromotionJson(created);
};

export const updatePromotion = async (
  id: number,
  req: Parameters<typeof createPromotion>[0],
) => {
  const exists = await prisma.promotion.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("Không tìm thấy khuyến mãi");
  const updated = await prisma.promotion.update({
    where: { id },
    data: {
      name: req.name,
      description: req.description ?? null,
      discountType: req.discountType,
      discountValue: req.discountValue,
      maxDiscount: req.maxDiscount ?? null,
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
    },
  });
  return toPromotionJson(updated);
};

export const deletePromotion = async (id: number) => {
  const exists = await prisma.promotion.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("Không tìm thấy khuyến mãi");
  await prisma.promotion.delete({ where: { id } });
};

// ----- Cấu hình AI / lịch sử hội thoại -----

export const listAiSettings = async () => {
  const rows = await prisma.aiSetting.findMany({ orderBy: { settingKey: "asc" } });
  return rows.map((r) => ({ settingKey: r.settingKey, settingValue: r.settingValue }));
};

export const saveAiSetting = async (settingKey: string, settingValue: string) => {
  const key = settingKey.trim();
  if (!key) throw badRequest("settingKey không được để trống");
  const row = await prisma.aiSetting.upsert({
    where: { settingKey: key },
    create: { settingKey: key, settingValue },
    update: { settingValue },
  });
  return { settingKey: row.settingKey, settingValue: row.settingValue };
};

export const chatHistory = async () => {
  const rows = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
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
  // Tên ngẫu nhiên để không trùng và không lộ thứ tự upload.
  const name = `${randomUUID()}${ext}`;
  writeFileSync(join(env.UPLOAD_DIR, name), buffer);
  return { url: `${protocol}://${host}/api/uploads/${name}`, mime: IMAGE_MIME[ext] };
};
