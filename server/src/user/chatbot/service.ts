import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, max } from "drizzle-orm";
import { HttpError, notFound, unauthorized } from "../../lib/errors.js";
import { chatMessages, users, type ChatMessagePayload } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import * as provider from "../../lib/provider.js";
import { sessionTitle, type ChatHistoryEntry, type ChatSessionSummary } from "./sessions.js";
import { parseMessage } from "./parse.js";
import { filterMenu, buildCards, quickRepliesFor } from "./select.js";
import { composeFoodReply, composeInfoReply } from "./reply.js";

const MISSING_KEY_NOTICE = "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.";

export type ChatIntent = "FOOD" | "RESTAURANT_INFO" | "ORDER_GUIDE" | "GREETING" | "OUT_OF_SCOPE" | "THANKS" | "CONFIRM";

export interface FoodCard {
  id: number;
  name: string;
  imageUrl: string | null;
  categoryName: string | null;
}

export interface ChatResponseBody {
  reply: string;
  foods: FoodCard[];
  intent: ChatIntent;
  citations: Array<{ sourceName: string; snippet: string }> | null;
  quickReplies: string[];
}

const maxSuggestionsAndRules = async (): Promise<{ maxSugg: number; extraRules: string }> => {
  const rows = await db.query.aiSetting.findMany({
    where: (t, { inArray }) => inArray(t.settingKey, ["max_suggestions", "extra_rules"]),
  });
  const map = new Map(rows.map((r) => [r.settingKey, r.settingValue?.trim() ?? ""]));
  const parsed = Number.parseInt(map.get("max_suggestions") ?? "", 10);
  const maxSugg = Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 5;
  return { maxSugg, extraRules: map.get("extra_rules") ?? "" };
};

const loadContext = async (userId: number, sessionId: string): Promise<{ history: string[]; lastFoodIds: number[] }> => {
  const userRows = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.userId, userId), eq(chatMessages.sessionId, sessionId), eq(chatMessages.sender, "USER")),
    orderBy: [desc(chatMessages.id)],
    limit: 3,
  });
  const history = userRows.map((r) => r.content).reverse();
  const botRow = await db.query.chatMessages.findFirst({
    where: and(eq(chatMessages.userId, userId), eq(chatMessages.sessionId, sessionId), eq(chatMessages.sender, "BOT")),
    orderBy: [desc(chatMessages.id)],
  });
  const foods = (botRow?.payload as ChatMessagePayload | null)?.foods ?? [];
  const lastFoodIds = foods.map((f) => f.id).filter((x): x is number => typeof x === "number");
  return { history, lastFoodIds };
};

const saveUserMessage = async (userId: number, sessionId: string, content: string): Promise<void> => {
  await db.insert(chatMessages).values({ userId, sessionId, sender: "USER", content: content.slice(0, 4000), payload: null });
};

const saveBotMessage = async (userId: number, sessionId: string, reply: string, payload: ChatMessagePayload): Promise<void> => {
  await db.insert(chatMessages).values({ userId, sessionId, sender: "BOT", content: reply.slice(0, 4000), payload });
};

export const chatbotStatus = async () => {
  const available = await provider.verifyKey();
  // Co khoa nhung moi model deu loi thi bao qua tai, khong bao thieu cau hinh.
  const notice = available ? null : provider.hasKeys() ? "Trợ lý AI đang quá tải, vui lòng thử lại sau." : MISSING_KEY_NOTICE;
  return { available, notice };
};

export const chat = async (
  email: string,
  input: { message: string; sessionId?: string },
): Promise<ChatResponseBody> => {
  if (!provider.isConfigured()) throw new HttpError(503, MISSING_KEY_NOTICE);

  const sessionId = input.sessionId?.trim() || randomUUID();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");

  const { history, lastFoodIds } = await loadContext(user.id, sessionId);

  await saveUserMessage(user.id, sessionId, input.message);

  const menuRows = await db.query.foods.findMany({ columns: { id: true, name: true } });
  const parsed = parseMessage(input.message, menuRows);

  // Nhanh tinh: xac nhan, chao, cam on, huong dan, ngoai pham vi.
  if (parsed.intent === "CONFIRM") {
    const reply = "Quý khách muốn xác nhận gì ạ? Nếu muốn đặt món, quý khách bấm vào thẻ món rồi thêm vào giỏ nhé!";
    await saveBotMessage(user.id, sessionId, reply, { intent: "CONFIRM", quickReplies: ["Gợi ý món cho 2 người"] });
    return { reply, foods: [], intent: "CONFIRM", citations: null, quickReplies: ["Gợi ý món cho 2 người"] };
  }
  if (parsed.intent === "GREETING") {
    const reply = "Chào quý khách! Tôi là trợ lý của quán. Tôi có thể gợi ý món theo ngân sách/số người, thông tin quán và hướng dẫn đặt món.";
    await saveBotMessage(user.id, sessionId, reply, { intent: "GREETING", quickReplies: ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?", "Cách đặt món thế nào?"] });
    return { reply, foods: [], intent: "GREETING", citations: null, quickReplies: ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?", "Cách đặt món thế nào?"] };
  }
  if (parsed.intent === "THANKS") {
    const reply = "Rất vui được hỗ trợ quý khách. Khi cần gợi ý món, quý khách cứ nhắn số người và ngân sách nhé!";
    await saveBotMessage(user.id, sessionId, reply, { intent: "THANKS", quickReplies: ["Gợi ý món cho 2 người"] });
    return { reply, foods: [], intent: "THANKS", citations: null, quickReplies: ["Gợi ý món cho 2 người"] };
  }
  if (parsed.intent === "ORDER_GUIDE") {
    const reply = "Để đặt món, quý khách thêm món vào giỏ rồi vào trang thanh toán. Thanh toán COD hoặc quét QR đều được.\n\n- Chỉ hủy được đơn đang chờ xử lý và chưa thanh toán.\n- Đơn đã hoàn thành hoặc đã hủy thì không thể sửa.\n- Khi đơn ở trạng thái \"Đang vận chuyển\", quán đang giao hàng cho quý khách.\n- Quý khách xem trạng thái đơn ở mục Đơn hàng của mình.";
    await saveBotMessage(user.id, sessionId, reply, { intent: "ORDER_GUIDE", quickReplies: ["Gợi ý món cho 2 người"] });
    return { reply, foods: [], intent: "ORDER_GUIDE", citations: null, quickReplies: ["Gợi ý món cho 2 người"] };
  }
  if (parsed.intent === "RESTAURANT_INFO") {
    const { reply, citations } = await composeInfoReply(input.message);
    await saveBotMessage(user.id, sessionId, reply, { intent: "RESTAURANT_INFO", citations, quickReplies: ["Gợi ý món cho 2 người", "Cách đặt món thế nào?"] });
    return { reply, foods: [], intent: "RESTAURANT_INFO", citations, quickReplies: ["Gợi ý món cho 2 người", "Cách đặt món thế nào?"] };
  }
  if (parsed.intent === "OUT_OF_SCOPE") {
    const reply = "Tôi chỉ tư vấn về món ăn của quán: gợi ý món theo số người, ngân sách, khẩu vị, thông tin quán và cách đặt món. Quý khách thử hỏi lại theo các mục đó nhé.";
    await saveBotMessage(user.id, sessionId, reply, { intent: "OUT_OF_SCOPE", quickReplies: ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"] });
    return { reply, foods: [], intent: "OUT_OF_SCOPE", citations: null, quickReplies: ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"] };
  }

  // Luong goi y mon: parse -> select -> reply.
  const more = parsed.more;
  const filtered = await filterMenu(parsed.criteria, {
    lastFoodIds,
    excludeIds: more && lastFoodIds.length ? lastFoodIds : undefined,
    restrictToLast: !more && parsed.onlyLast,
    restrictIds: parsed.criteria.dishIds.length > 0 ? parsed.criteria.dishIds : undefined,
  });

  const { maxSugg, extraRules } = await maxSuggestionsAndRules();
  const { reply: rawReply, picked } = await composeFoodReply(
    input.message,
    filtered,
    history,
    maxSugg,
    extraRules,
  );

  // safeReply da duoc goi trong composeFoodReply; o day chi tap hop the.
  const cards = buildCards(picked, maxSugg);

  const quickReplies = quickRepliesFor(cards);

  await saveBotMessage(user.id, sessionId, rawReply, {
    foods: cards,
    intent: "FOOD",
    quickReplies,
  });

  return {
    reply: rawReply,
    foods: cards,
    intent: "FOOD",
    citations: null,
    quickReplies,
  };
};

export const getLatestSession = async (email: string): Promise<{ sessionId: string | null; messages: ChatHistoryEntry[] }> => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  const rows = await db.select({ sessionId: chatMessages.sessionId, updatedAt: max(chatMessages.createdAt) })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, user.id), isNotNull(chatMessages.sessionId)))
    .groupBy(chatMessages.sessionId)
    .orderBy(desc(max(chatMessages.createdAt)))
    .limit(1);
  if (rows.length === 0 || !rows[0]!.sessionId) return { sessionId: null, messages: [] };
  const sid = rows[0]!.sessionId;
  const detail = await getSession(email, sid);
  return { sessionId: sid, messages: detail.messages };
};

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
  return {
    sessionId,
    messages: rows.map((row) => ({
      id: row.id,
      sender: row.sender,
      content: row.content,
      foods: row.payload?.foods
        ? row.payload.foods.map((f) => ({ id: f.id, name: f.name, imageUrl: f.imageUrl, categoryName: f.categoryName }))
        : null,
      intent: row.payload?.intent ?? null,
      citations: row.payload?.citations ?? null,
      quickReplies: row.payload?.quickReplies ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
};

export const deleteSession = async (email: string, sessionId: string) => {
  const user = await getUserOrThrow(email);
  const deleted = await db.delete(chatMessages).where(and(eq(chatMessages.userId, user.id), eq(chatMessages.sessionId, sessionId))).returning({ id: chatMessages.id });
  if (deleted.length === 0) throw notFound("Không tìm thấy hội thoại");
  return {};
};