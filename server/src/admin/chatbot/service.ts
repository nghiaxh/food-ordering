import { asc } from "drizzle-orm";
import { aiSetting } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { badRequest } from "../../lib/errors.js";

// Cau hinh AI va tai lieu chatbot danh cho quan tri.
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
