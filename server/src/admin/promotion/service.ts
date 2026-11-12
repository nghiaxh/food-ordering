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


// Khuyen mai

// 0 hoac rong = khong gioi han luot dung; DB luu null cho truong hop nay.
const normalizeUsageLimit = (usageLimit?: number | null): number | null =>
  usageLimit != null && usageLimit > 0 ? usageLimit : null;

// Quan ly khuyen mai tu dong: pham vi, khung gio, ngay trong tuan, mon may man.
export const toPromotionJson = (p: {
  id: number;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: unknown;
  maxDiscount: unknown;
  minOrderTotal: unknown;
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
  minOrderTotal: p.minOrderTotal == null ? null : Number(p.minOrderTotal),
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
  minOrderTotal?: number | null;
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
  minOrderTotal?: number | null;
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
      minOrderTotal: req.minOrderTotal != null ? String(req.minOrderTotal) : null,
      scope: req.scope,
      targetIds: req.targetIds ?? [],
      startsAt: req.startsAt,
      endsAt: req.endsAt,
      daysOfWeek: req.daysOfWeek?.trim() ? req.daysOfWeek.trim() : null,
      startTime: req.startTime ?? null,
      endTime: req.endTime ?? null,
      active: req.active,
      priority: req.priority,
      usageLimit: normalizeUsageLimit(req.usageLimit),
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
      minOrderTotal: req.minOrderTotal != null ? String(req.minOrderTotal) : null,
      scope: req.scope,
      targetIds: req.targetIds ?? [],
      startsAt: req.startsAt,
      endsAt: req.endsAt,
      daysOfWeek: req.daysOfWeek?.trim() ? req.daysOfWeek.trim() : null,
      startTime: req.startTime ?? null,
      endTime: req.endTime ?? null,
      active: req.active,
      priority: req.priority,
      usageLimit: normalizeUsageLimit(req.usageLimit),
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
