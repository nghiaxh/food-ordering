import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, max } from "drizzle-orm";
import { HttpError, notFound, unauthorized } from "../../lib/errors.js";
import { aiSetting, chatMessages, foods, users, type ChatMessagePayload } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import * as gemini from "../../lib/gemini.js";
import { plain } from "../../lib/text-normalizer.js";
import { sessionTitle, type ChatHistoryEntry, type ChatSessionSummary } from "./sessions.js";
import { readConstraints, BARE_NUMBER, parseBudget, parsePeople, matchDishes, vnd } from "./constraints.js";
import type { FoodWithCategory, Picked } from "./constraints.js";
import { filterCandidates } from "./filter.js";
import { verifyReply } from "./grounding.js";
import { searchChunks, type ScoredChunk } from "./retrieval.js";
import { CHAT_PROMPT } from "./prompts.js";

const MISSING_KEY_NOTICE = "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.";

export type ChatIntent = "FOOD" | "RESTAURANT_INFO" | "ORDER_GUIDE" | "GREETING" | "OUT_OF_SCOPE";

export interface FoodCard {
  id: number;
  name: string;
  price: string;
  imageUrl: string | null;
  categoryName: string | null;
  portions: number;
  totalPrice: string;
}

export interface ChatResponseBody {
  reply: string;
  foods: FoodCard[];
  intent: ChatIntent;
  citations: Array<{ sourceName: string; snippet: string }> | null;
  quickReplies: string[];
}

const toCard = (p: Picked): FoodCard => ({
  id: p.food.id,
  name: p.food.name,
  price: String(Number(p.food.price)),
  imageUrl: p.food.imageUrl,
  categoryName: p.food.category?.name ?? null,
  portions: p.portions,
  totalPrice: String(p.totalPrice),
});

const maxSuggestions = async (): Promise<number> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, "max_suggestions") });
  const parsed = Number.parseInt(row?.settingValue?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(5, parsed));
};

const extraRules = async (): Promise<string> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, "extra_rules") });
  const value = row?.settingValue?.trim();
  return value ? `Quy tắc bổ sung của nhà hàng: ${value}` : "";
};

const portionsFor = (food: FoodWithCategory, people: number | null | undefined): number => {
  if (!people || people <= 0) return 1;
  const serving = Math.max(1, food.servingSize);
  return Math.ceil(people / serving);
};

const toPicked = (food: FoodWithCategory, people: number | null | undefined): Picked => {
  const portions = portionsFor(food, people);
  return { food, portions, totalPrice: Number(food.price) * portions };
};

const truncate = (s: string, max: number): string => {
  const t = s.replaceAll(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trim()}...`;
};

// --- Bước 1: Chuẩn bị dữ liệu (Drizzle, không gọi AI) ---

interface PreparedData {
  menu: FoodWithCategory[];
  filteredMenu: FoodWithCategory[];
  chunks: ScoredChunk[];
}

const prepare = async (
  message: string,
  lastFoodIds: number[] | undefined | null,
): Promise<PreparedData> => {
  const menu = (await db.query.foods.findMany({ with: { category: true } })) as FoodWithCategory[];
  const availableMenu = menu.filter((f) => f.available);

  // Regex pre-filter nhẹ: chay / không cay / allergen
  const constraints = readConstraints(message, availableMenu);
  let filtered = availableMenu;
  if (constraints.chay) {
    filtered = filtered.filter((f) => (f.dietaryTags ?? "").toLowerCase().includes("chay"));
  }
  if (constraints.spicyMax != null) {
    filtered = filtered.filter((f) => f.spicyLevel <= (constraints.spicyMax as number));
  }
  if (constraints.exclude.length > 0) {
    filtered = filtered.filter((f) =>
      !constraints.exclude.some(
        (e) =>
          (f.allergens ?? "").toLowerCase().includes(e.toLowerCase()) ||
          (f.ingredients ?? "").toLowerCase().includes(e.toLowerCase()),
      ),
    );
  }
  if (filtered.length === 0) filtered = availableMenu;

  const chunks = await searchChunks(message, 5);

  return { menu: availableMenu, filteredMenu: filtered, chunks };
};

// --- Bước 2: 1 lượt AI (jsonMode) ---

interface AiResult {
  intent: ChatIntent;
  reply: string;
  pickedIds: number[];
  people: number | null;
  quickReplies: string[];
}

const VALID_INTENTS: ChatIntent[] = ["FOOD", "RESTAURANT_INFO", "ORDER_GUIDE", "GREETING", "OUT_OF_SCOPE"];

const analyze = async (
  prepared: PreparedData,
  message: string,
  history: string[],
  lastFoodIds: number[] | undefined | null,
): Promise<AiResult> => {
  const menuText = prepared.filteredMenu
    .map((f) => `${f.id}|${f.name}|${Number(f.price)}|${f.category?.name ?? ""}|${f.spicyLevel}|${f.dietaryTags ?? ""}`)
    .join("\n");

  const chunksText = prepared.chunks.length > 0
    ? prepared.chunks.map((c) => `- ${truncate(c.chunk.content, 300)}`).join("\n")
    : "(không có)";

  const historyText = history.length > 0 ? history.join("\n") : "(không có)";
  const lastIdsText = lastFoodIds?.length ? lastFoodIds.join(", ") : "(không có)";

  const systemPrompt = CHAT_PROMPT
    .replace("%s", menuText)
    .replace("%s", chunksText)
    .replace("%s", historyText)
    .replace("%s", lastIdsText);

  const extra = await extraRules();
  const fullSystem = extra ? `${systemPrompt}\n${extra}` : systemPrompt;

  let raw: string;
  try {
    raw = await gemini.generate(fullSystem, message, true, {
      timeoutMs: gemini.AI_TIMEOUTS.reply,
      maxOutputTokens: gemini.AI_MAX_OUTPUT_TOKENS,
    });
  } catch (error) {
    if (error instanceof gemini.AiKeyRejectedException) {
      throw new HttpError(503, MISSING_KEY_NOTICE);
    }
    if (error instanceof gemini.AiRateLimitedException) {
      throw new HttpError(429, "Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau");
    }
    throw new HttpError(502, "Không gọi được dịch vụ AI");
  }

  const cleaned = raw.replaceAll("```json", "").replaceAll("```", "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new HttpError(422, "Phản hồi AI không hợp lệ");
  }

  const intent = VALID_INTENTS.includes(parsed.intent as ChatIntent)
    ? (parsed.intent as ChatIntent)
    : "FOOD";

  const reply = typeof parsed.reply === "string" && parsed.reply.trim()
    ? parsed.reply.trim()
    : "Mình chưa có câu trả lời phù hợp, bạn thử hỏi lại nhé!";

  const pickedIds = Array.isArray(parsed.pickedIds)
    ? (parsed.pickedIds as unknown[]).filter((x): x is number => typeof x === "number" && Number.isInteger(x))
    : [];

  const people = typeof parsed.people === "number" && parsed.people > 0 && parsed.people <= 50
    ? parsed.people
    : null;

  const quickReplies = Array.isArray(parsed.quickReplies)
    ? (parsed.quickReplies as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 4)
    : [];

  return { intent, reply, pickedIds, people, quickReplies };
};

// --- Bước 3: Validate picks + verify reply + save + return (gộp pick+verify) ---

const finalize = async (
  prepared: PreparedData,
  ai: AiResult,
  email: string | null,
  sessionId: string,
  message: string,
): Promise<ChatResponseBody> => {
  const maxSugg = await maxSuggestions();

  // PICK: validate id tồn tại & available, build cards từ DB (giá từ DB)
  const cards = ai.pickedIds
    .map((id) => prepared.menu.find((f) => f.id === id && f.available))
    .filter((f): f is FoodWithCategory => !!f)
    .slice(0, maxSugg)
    .map((f) => toPicked(f, ai.people))
    .map(toCard);

  // VERIFY: nếu vi phạm → báo lỗi cho user (throw), không thay reply
  const ctx = {
    allowedPrices: cards.map((c) => Number(c.price)),
    allowedFoodNames: cards.map((c) => c.name),
    allowedChunks: prepared.chunks.map((c) => c.chunk.content),
  };
  const check = verifyReply(ai.reply, ctx);
  if (!check.ok) {
    throw new HttpError(422, "Câu trả lời không khớp dữ liệu món, vui lòng thử lại");
  }

  // SAVE + RETURN
  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;
  if (user) {
    await db.insert(chatMessages).values({
      userId: user.id,
      sessionId,
      sender: "BOT",
      content: ai.reply.slice(0, 4000),
      payload: { foods: cards, intent: ai.intent, quickReplies: ai.quickReplies } as ChatMessagePayload,
    });
  }

  const citations = prepared.chunks.length > 0
    ? prepared.chunks.map((c: ScoredChunk) => ({
        sourceName: c.document?.title ?? "Tài liệu quán",
        snippet: truncate(c.chunk.content, 120),
      }))
    : null;

  return {
    reply: ai.reply,
    foods: cards,
    intent: ai.intent,
    citations: ai.intent === "RESTAURANT_INFO" ? citations : null,
    quickReplies: ai.quickReplies.length > 0 ? ai.quickReplies : (cards.length > 0 ? ["Món khác", "Món chay không cay"] : ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"]),
  };
};

// --- Orchestrator ---

export const chat = async (
  email: string | null,
  input: { message: string; sessionId?: string; history?: string[]; lastFoodIds?: number[] },
): Promise<ChatResponseBody> => {
  // requireConfigured
  if (!gemini.isConfigured()) {
    throw new HttpError(503, MISSING_KEY_NOTICE);
  }

  const sessionId = input.sessionId?.trim() || randomUUID();
  const history = (input.history ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;
  if (user) {
    await db.insert(chatMessages).values({
      userId: user.id,
      sessionId,
      sender: "USER",
      content: input.message.slice(0, 4000),
      payload: null,
    });
  }

  // Bước 1: Chuẩn bị dữ liệu
  const prepared = await prepare(input.message, input.lastFoodIds);

  // Bước 2: 1 lượt AI
  const ai = await analyze(prepared, input.message, history, input.lastFoodIds);

  // Bước 3: Validate + verify + save + return
  return finalize(prepared, ai, email, sessionId, input.message);
};

// --- Status ---

export const chatbotStatus = async () => {
  const available = await gemini.verifyKey();
  return { available, notice: available ? null : MISSING_KEY_NOTICE };
};

// --- Sessions (unchanged) ---

const getUserOrThrow = async (email: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  return user;
};

export const listSessions = async (email: string): Promise<ChatSessionSummary[]> => {
  const user = await getUserOrThrow(email);
  const rows = await db
    .select({
      sessionId: chatMessages.sessionId,
      updatedAt: max(chatMessages.createdAt),
      messageCount: count(),
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, user.id), isNotNull(chatMessages.sessionId)))
    .groupBy(chatMessages.sessionId)
    .orderBy(desc(max(chatMessages.createdAt)))
    .limit(20);

  const sessionIds = rows.map((row) => row.sessionId).filter((id): id is string => !!id);
  if (sessionIds.length === 0) return [];

  const firsts = await db
    .select({ sessionId: chatMessages.sessionId, content: chatMessages.content })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, user.id),
        inArray(chatMessages.sessionId, sessionIds),
        eq(chatMessages.sender, "USER"),
      ),
    )
    .orderBy(asc(chatMessages.id));
  const titles = new Map<string, string>();
  for (const row of firsts) {
    if (row.sessionId && !titles.has(row.sessionId)) titles.set(row.sessionId, row.content);
  }

  return rows.flatMap((row) => {
    if (!row.sessionId) return [];
    return [{
      sessionId: row.sessionId,
      title: sessionTitle(titles.get(row.sessionId)),
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
      messageCount: Number(row.messageCount),
    }];
  });
};

export const getSession = async (
  email: string,
  sessionId: string,
): Promise<{ sessionId: string; messages: ChatHistoryEntry[] }> => {
  const user = await getUserOrThrow(email);
  const rows = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.userId, user.id), eq(chatMessages.sessionId, sessionId)),
    orderBy: [asc(chatMessages.id)],
  });
  if (rows.length === 0) throw notFound("Không tìm thấy hội thoại");

  return {
    sessionId,
    messages: rows.map((row) => ({
      id: row.id,
      sender: row.sender,
      content: row.content,
      foods: row.payload?.foods ?? null,
      intent: row.payload?.intent ?? null,
      citations: row.payload?.citations ?? null,
      quickReplies: row.payload?.quickReplies ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
};

export const deleteSession = async (email: string, sessionId: string) => {
  const user = await getUserOrThrow(email);
  const deleted = await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.userId, user.id), eq(chatMessages.sessionId, sessionId)))
    .returning({ id: chatMessages.id });
  if (deleted.length === 0) throw notFound("Không tìm thấy hội thoại");
  return {};
};