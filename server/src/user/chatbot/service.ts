import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, lte, gt, sql, ilike, or, max, type SQL } from "drizzle-orm";
import { HttpError, notFound, unauthorized } from "../../lib/errors.js";
import { aiSetting, chatMessages, foods, users, type ChatMessagePayload } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import * as provider from "../../lib/provider.js";
import { plain } from "../../lib/text-normalizer.js";
import { sessionTitle, type ChatHistoryEntry, type ChatSessionSummary } from "./sessions.js";
import { readConstraints } from "./constraints.js";
import type { FoodWithCategory } from "./constraints.js";
import { verifyReply } from "./grounding.js";
import { searchChunks, type ScoredChunk } from "./retrieval.js";
import { EXTRACT_PROMPT, REPLY_PROMPT } from "./prompts.js";

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

const toCard = (food: FoodWithCategory, people: number | null): FoodCard => {
  const portions = people && people > 0 ? Math.ceil(people / Math.max(1, food.servingSize)) : 1;
  return {
    id: food.id,
    name: food.name,
    price: String(Number(food.price)),
    imageUrl: food.imageUrl,
    categoryName: food.category?.name ?? null,
    portions,
    totalPrice: String(Number(food.price) * portions),
  };
};

const maxSuggestions = async (): Promise<number> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, "max_suggestions") });
  const parsed = Number.parseInt(row?.settingValue?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(5, parsed));
};

const truncate = (s: string, max: number): string => {
  const t = s.replaceAll(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trim()}...`;
};

// --- Bước 1: Tai lieu quan (RAG) ---
// Chi dung cho cau hoi thong tin quan. Nhanh goi y mon khong goi embedding de tiet kiem.

// --- Bước 2: AI trích tiêu chí (call 1) ---

interface Criteria {
  budget: number | null;
  people: number | null;
  spicyMax: number | null;
  spicyRequired: boolean;
  allergens: string[];
  diet: string[];
  keywords: string[];
  categories: string[];
}

// Ngan sach khach neu la TONG cho ca nhom, nen moi mon bi chan o muc budget / so nguoi.
// Nho vay mot bo "so nguoi" mon luon nam trong ngan sach, khong can cong don o code.
const perDishCap = (criteria: Criteria): number | null => {
  if (!criteria.budget || criteria.budget <= 0) return null;
  const people = Math.max(1, criteria.people ?? 1);
  return Math.max(1, Math.floor(criteria.budget / people));
};

// Do uong / trang mieng chi duoc uu tien khi khach hoi ro; con lai de the mon khong toan tra, che.
const DRINK_DESSERT_SLUGS = new Set(["do-uong", "trang-mieng"]);

const asksForDrinkOrDessert = (criteria: Criteria): boolean => {
  const text = plain([...criteria.categories, ...criteria.keywords].join(" "));
  return ["uong", "tra", "ca phe", "sinh to", "nuoc", "che", "banh", "trang mieng", "dessert"].some((k) => text.includes(k));
};

const extractCriteria = async (message: string, history: string[]): Promise<Criteria> => {
  const historyText = history.length > 0 ? history.join("\n") : "(không có)";
  const prompt = EXTRACT_PROMPT;
  const userMsg = `CÂU HỎI TRƯỚC:\n${historyText}\n\nCÂU HỎI: ${message}`;

  try {
    const raw = await provider.generate(prompt, userMsg, true, {
      timeoutMs: provider.AI_TIMEOUTS.extract,
      // Model co thinking can cho token truoc khi ra JSON; cat qua ngan se mat ca cau tra loi.
      maxOutputTokens: 600,
    });
    const cleaned = raw.replaceAll("```json", "").replaceAll("```", "").trim();
    // Thử extract JSON nếu có text thừa
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
    const parsed = JSON.parse(jsonStr);
    return {
      budget: typeof parsed.budget === "number" && parsed.budget > 0 ? parsed.budget : null,
      people: typeof parsed.people === "number" && parsed.people > 0 && parsed.people <= 50 ? parsed.people : null,
      spicyMax: typeof parsed.spicyMax === "number" && parsed.spicyMax >= 0 && parsed.spicyMax <= 3 ? parsed.spicyMax : null,
      spicyRequired: !!parsed.spicyRequired,
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens.filter((x: unknown) => typeof x === "string") : [],
      diet: Array.isArray(parsed.diet) ? parsed.diet.filter((x: unknown) => typeof x === "string") : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((x: unknown) => typeof x === "string") : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    // Fallback: regex
    const c = readConstraints(message, []);
    return {
      budget: c.budgetTotal,
      people: c.people,
      spicyMax: c.spicyMax,
      spicyRequired: c.spicyRequired,
      allergens: c.exclude,
      diet: c.diets,
      keywords: [],
      categories: c.groups.map((g) => g.name),
    };
  }
};

// --- Bước 3: SQL filter ---

const filterMenu = async (
  criteria: Criteria,
  lastFoodIds: number[] | undefined | null,
): Promise<FoodWithCategory[]> => {
  const isFollowUp = lastFoodIds?.length && !criteria.keywords.length && !criteria.categories.length && !criteria.allergens.length && !criteria.diet.length;

  const whereConditions: SQL[] = [eq(foods.available, true)];

  if (isFollowUp) {
    whereConditions.push(inArray(foods.id, lastFoodIds!));
  }
  if (criteria.spicyMax != null) whereConditions.push(lte(foods.spicyLevel, criteria.spicyMax));
  if (criteria.spicyRequired) whereConditions.push(gt(foods.spicyLevel, 0));
  const cap = perDishCap(criteria);
  if (cap != null) whereConditions.push(sql`${foods.price}::numeric <= ${cap}`);
  if (criteria.allergens?.length) {
    for (const a of criteria.allergens) {
      whereConditions.push(sql`${foods.allergens} NOT ILIKE ${"%" + a + "%"}`);
      whereConditions.push(sql`${foods.ingredients} NOT ILIKE ${"%" + a + "%"}`);
    }
  }
  if (criteria.diet?.length) {
    for (const d of criteria.diet) {
      whereConditions.push(sql`${foods.dietaryTags} ILIKE ${"%" + d + "%"}`);
    }
  }
  if (criteria.keywords?.length) {
    const kwConds = criteria.keywords.map((k) =>
      or(ilike(foods.name, `%${k}%`), ilike(foods.ingredients, `%${k}%`)),
    );
    whereConditions.push(or(...kwConds)!);
  }

  // Lay du rong de buoc loc do uong/trang mieng va loc danh muc phia duoi van con mon.
  const rows = await db.query.foods.findMany({
    where: and(...whereConditions),
    with: { category: true },
    orderBy: [asc(foods.price)],
    limit: 100,
  }) as FoodWithCategory[];

  let result = rows.filter((f) => f.available);

  // Khach hoi "mon an" chung chung thi bo do uong / trang mieng, nhung giu lai neu do la ket qua duy nhat.
  if (!asksForDrinkOrDessert(criteria)) {
    const mains = result.filter((f) => !DRINK_DESSERT_SLUGS.has(f.category?.slug ?? ""));
    if (mains.length > 0) result = mains;
  }

  if (criteria.categories?.length) {
    const wanted = criteria.categories.map((c) => plain(c));
    const matched = result.filter((f) => {
      const name = plain(f.category?.name ?? "");
      if (!name) return false;
      return wanted.some((c) => name.includes(c) || c.includes(name));
    });
    if (matched.length > 0) result = matched;
  }

  return result.slice(0, 10);
}

// --- Bước 4: AI viết reply (call 2) ---

const describeCriteria = (criteria: Criteria): string => {
  const parts: string[] = [];
  if (criteria.people) parts.push(`${criteria.people} người`);
  if (criteria.budget) parts.push(`tổng ${criteria.budget.toLocaleString("vi-VN")}đ`);
  if (criteria.spicyMax === 0) parts.push("không cay");
  if (criteria.diet.length) parts.push(`chế độ ${criteria.diet.join(", ")}`);
  if (criteria.allergens.length) parts.push(`tránh ${criteria.allergens.join(", ")}`);
  if (criteria.categories.length) parts.push(`loại ${criteria.categories.join(", ")}`);
  if (criteria.keywords.length) parts.push(`từ khóa ${criteria.keywords.join(", ")}`);
  return parts.length > 0 ? parts.join("; ") : "khách chưa nêu điều kiện, gợi ý món bán chạy";
};

// Goi AI viet cau tra loi dua tren danh sach mon server da loc. Loi AI thi bao loi,
// khong render template: nguoi dung can biet tro ly dang khong dung duoc.
const generateReply = async (
  message: string,
  criteria: Criteria,
  foods: FoodWithCategory[],
): Promise<string> => {
  const menuText = foods
    .map((f) => `${f.name} - ${Number(f.price).toLocaleString("vi-VN")}đ - ${f.category?.name ?? "món"}`)
    .join("\n");
  const prompt = REPLY_PROMPT
    .replace("%s", describeCriteria(criteria))
    .replace("%s", menuText || "(trống)")
    .replace("%s", message);

  let raw: string;
  try {
    raw = await provider.generate(prompt, "", false, {
      timeoutMs: provider.AI_TIMEOUTS.reply,
      maxOutputTokens: provider.AI_MAX_OUTPUT_TOKENS,
    });
  } catch {
    throw new HttpError(502, "Trợ lý AI đang gặp sự cố, quý khách vui lòng thử lại sau ít phút.");
  }

  // Model nho hay copy lai dinh dang danh sach (kem ID); bo phan dinh dang con sot.
  const reply = raw
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/\s*[-–]\s*\d{1,3}\.\d{3}đ\s*-\s*.+$/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!reply) throw new HttpError(502, "Trợ lý AI chưa trả lời được, quý khách vui lòng thử lại.");
  return reply;
};

// --- Bước 5: Finalize ---

const finalize = async (
  filtered: FoodWithCategory[],
  reply: string,
  people: number | null,
  email: string | null,
  sessionId: string,
): Promise<ChatResponseBody> => {
  const maxSugg = await maxSuggestions();
  const cards = filtered.slice(0, maxSugg).map((f) => toCard(f, people));

  // verifyReply chi con kiem do dai cau tra loi; sai thi ghi log, khong chan khach.
  const check = verifyReply(reply, {
    allowedPrices: cards.map((c) => Number(c.price)),
    allowedFoodNames: cards.map((c) => c.name),
    allowedChunks: [],
  });
  if (!check.ok) {
    console.warn("[chatbot] verifyReply warnings:", check.violations);
  }

  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;
  if (user) {
    await db.insert(chatMessages).values({
      userId: user.id,
      sessionId,
      sender: "BOT",
      content: reply.slice(0, 4000),
      payload: { foods: cards, intent: "FOOD", quickReplies: [] } as ChatMessagePayload,
    });
  }

  return {
    reply,
    foods: cards,
    intent: "FOOD",
    citations: null,
    quickReplies: cards.length > 0 ? ["Món khác", "Món chay không cay"] : ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"],
  };
};

// --- Orchestrator ---

const isRestaurantInfoQuestion = (p: string): boolean =>
  ["mo cua", "dong cua", "gio mo", "gio dong", "o dia chi", "dia chi", "phi ship", "thoi gian giao", "giao hang o dau", "quan o dau", "sdt", "so dien thoai"].some((k) => p.includes(k));

const isOrderGuideQuestion = (p: string): boolean =>
  ["cach dat", "dat mon", "dat hang", "thanh toan", "huy don", "don hang", "trang thai don", "theo doi don", "xem don", "don cua toi", "giao hang the nao"].some((k) => p.includes(k));

const isGreetingQuestion = (p: string): boolean => {
  const hasTopic = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes", "mo cua", "dia chi", "phi ship", "thanh toan", "huy don", "don hang"].some((k) => p.includes(k));
  if (hasTopic) return false;
  return ["xin chao", "chao", "chao ban", "hello", "hi", "hey", "alo"].some((g) => p === g || p.startsWith(`${g} `));
};

export const chat = async (
  email: string | null,
  input: { message: string; sessionId?: string; history?: string[]; lastFoodIds?: number[] },
): Promise<ChatResponseBody> => {
  if (!provider.isConfigured()) throw new HttpError(503, MISSING_KEY_NOTICE);

  const sessionId = input.sessionId?.trim() || randomUUID();
  const history = (input.history ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;
  if (user) {
    await db.insert(chatMessages).values({ userId: user.id, sessionId, sender: "USER", content: input.message.slice(0, 4000), payload: null });
  }

  const p = plain(input.message);

  // Xu ly graceful cho input khong ro: "Xac nhan", single word, etc.
  if (p === "xac nhan" || p === "xacnhan" || p === "ok" || p === "dong y") {
    const reply = "Quý khách muốn xác nhận gì ạ? Nếu muốn đặt món, quý khách bấm vào thẻ món rồi thêm vào giỏ nhé!";
    if (user) await db.insert(chatMessages).values({ userId: user.id, sessionId, sender: "BOT", content: reply, payload: { intent: "FOOD", quickReplies: [] } as ChatMessagePayload });
    return { reply, foods: [], intent: "FOOD", citations: null, quickReplies: ["Gợi ý món cho 2 người"] };
  }

  // Static intents (no AI)
  if (isRestaurantInfoQuestion(p)) {
    const chunks = await searchChunks(input.message, 5);
    const reply = chunks.length > 0
      ? chunks.map((c) => `- ${truncate(c.chunk.content, 400)}`).join("\n")
      : "Tôi chưa có thông tin xác thực về mục này trong tài liệu của quán.";
    const citations = chunks.length > 0 ? chunks.map((c: ScoredChunk) => ({ sourceName: c.document?.title ?? "Tài liệu quán", snippet: truncate(c.chunk.content, 120) })) : null;
    if (user) await db.insert(chatMessages).values({ userId: user.id, sessionId, sender: "BOT", content: reply.slice(0, 4000), payload: { intent: "RESTAURANT_INFO", citations, quickReplies: [] } as ChatMessagePayload });
    return { reply, foods: [], intent: "RESTAURANT_INFO", citations, quickReplies: ["Gợi ý món cho 2 người", "Cách đặt món thế nào?"] };
  }
  if (isOrderGuideQuestion(p)) {
    const reply = "Để đặt món, quý khách thêm món vào giỏ rồi vào trang thanh toán. Thanh toán COD hoặc quét QR đều được.\n\n- Chỉ hủy được đơn đang chờ xử lý và chưa thanh toán.\n- Đơn đã hoàn thành hoặc đã hủy thì không thể sửa.\n- Khi đơn ở trạng thái \"Đang vận chuyển\", quán đang giao hàng cho quý khách.\n- Quý khách xem trạng thái đơn ở mục Đơn hàng của mình.";
    if (user) await db.insert(chatMessages).values({ userId: user.id, sessionId, sender: "BOT", content: reply, payload: { intent: "ORDER_GUIDE", quickReplies: [] } as ChatMessagePayload });
    return { reply, foods: [], intent: "ORDER_GUIDE", citations: null, quickReplies: ["Gợi ý món cho 2 người"] };
  }
  if (isGreetingQuestion(p)) {
    const reply = "Chào quý khách! Tôi là trợ lý của quán. Tôi có thể gợi ý món theo ngân sách/số người, thông tin quán và hướng dẫn đặt món.";
    if (user) await db.insert(chatMessages).values({ userId: user.id, sessionId, sender: "BOT", content: reply, payload: { intent: "GREETING", quickReplies: [] } as ChatMessagePayload });
    return { reply, foods: [], intent: "GREETING", citations: null, quickReplies: ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?", "Cách đặt món thế nào?"] };
  }

  // Bước 1: Trích tiêu chí (AI call 1)
  const criteria = await extractCriteria(input.message, history);

  // Bước 2: SQL filter
  const filtered = await filterMenu(criteria, input.lastFoodIds);

  // Bước 3: AI viết reply (call 2)
  const reply = await generateReply(input.message, criteria, filtered);

  // Bước 4: Finalize
  return finalize(filtered, reply, criteria.people, email, sessionId);
};

export const chatbotStatus = async () => {
  const available = await provider.verifyKey();
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
  const rows = await db.select({ sessionId: chatMessages.sessionId, updatedAt: max(chatMessages.createdAt), messageCount: count() })
    .from(chatMessages).where(and(eq(chatMessages.userId, user.id), isNotNull(chatMessages.sessionId)))
    .groupBy(chatMessages.sessionId).orderBy(desc(max(chatMessages.createdAt))).limit(20);
  const sessionIds = rows.map((r) => r.sessionId).filter((id): id is string => !!id);
  if (sessionIds.length === 0) return [];
  const firsts = await db.select({ sessionId: chatMessages.sessionId, content: chatMessages.content }).from(chatMessages)
    .where(and(eq(chatMessages.userId, user.id), inArray(chatMessages.sessionId, sessionIds), eq(chatMessages.sender, "USER"))).orderBy(asc(chatMessages.id));
  const titles = new Map<string, string>();
  for (const row of firsts) if (row.sessionId && !titles.has(row.sessionId)) titles.set(row.sessionId, row.content);
  return rows.flatMap((row) => {
    if (!row.sessionId) return [];
    return [{ sessionId: row.sessionId, title: sessionTitle(titles.get(row.sessionId)), updatedAt: (row.updatedAt ?? new Date()).toISOString(), messageCount: Number(row.messageCount) }];
  });
};

export const getSession = async (email: string, sessionId: string): Promise<{ sessionId: string; messages: ChatHistoryEntry[] }> => {
  const user = await getUserOrThrow(email);
  const rows = await db.query.chatMessages.findMany({ where: and(eq(chatMessages.userId, user.id), eq(chatMessages.sessionId, sessionId)), orderBy: [asc(chatMessages.id)] });
  if (rows.length === 0) throw notFound("Không tìm thấy hội thoại");
  return { sessionId, messages: rows.map((row) => ({ id: row.id, sender: row.sender, content: row.content, foods: row.payload?.foods ?? null, intent: row.payload?.intent ?? null, citations: row.payload?.citations ?? null, quickReplies: row.payload?.quickReplies ?? null, createdAt: row.createdAt.toISOString() })) };
};

export const deleteSession = async (email: string, sessionId: string) => {
  const user = await getUserOrThrow(email);
  const deleted = await db.delete(chatMessages).where(and(eq(chatMessages.userId, user.id), eq(chatMessages.sessionId, sessionId))).returning({ id: chatMessages.id });
  if (deleted.length === 0) throw notFound("Không tìm thấy hội thoại");
  return {};
};