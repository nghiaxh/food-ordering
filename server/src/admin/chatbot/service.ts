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


// ----- Cau hinh AI / lich su hoi thoai -----

// Cau hinh AI, lich su hoi thoai va tai lieu chatbot danh cho quan tri.
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
