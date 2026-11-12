import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { HttpError } from "../../lib/errors.js";
import { aiSetting, chatMessages, foods, users } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import * as gemini from "../../lib/gemini.js";
import { plain } from "../../lib/text-normalizer.js";
import {
  BARE_NUMBER,
  isFoodQuestion,
  parseBudget,
  parsePeople,
  readFilters,
  type Filters,
} from "./filters.js";
import {
  isFollowUp,
  isReferenceKeyword,
  normalizeCriteria,
  criteriaSchema,
  type NormalizedCriteria,
} from "./criteria.js";
import {
  fallbackReply,
  pickWithinTotalBudget,
  selectContextByCode,
  selectFoods,
  selectFoodsByCode,
  type FoodWithCategory,
  type Picked,
} from "./select.js";
import { keywordSearchKnowledge, searchChunks, type ScoredChunk } from "./retrieval.js";
import { ANSWER_PROMPT, EXTRACT_PROMPT } from "./prompts.js";

const MISSING_KEY_NOTICE = "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.";

const QR_FOOD = ["Món khác", "Món chay không cay", "Cách đặt món thế nào?"];
const QR_FOOD_EMPTY = ["Món khác", "Món chay không cay"];
const QR_INFO = ["Gợi ý món cho 2 người", "Cách đặt món thế nào?"];
const QR_GUIDE = ["Gợi ý món cho 2 người"];
const QR_DECLINE = ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"];
const QR_FOLLOWUP = ["1 người", "2 người", "4 người"];

/** Cau hoi goc bi hoan khi bot hoi "may nguoi?" de ghep voi cau tra loi ngan cua khach. */
const pendingFollowUp = new Map<string, { originalMessage: string; expiresAtMs: number }>();
const FOLLOW_UP_TTL_MS = 10 * 60 * 1000;

const prunePendingFollowUp = () => {
  const now = Date.now();
  for (const [key, value] of pendingFollowUp) {
    if (value.expiresAtMs <= now) pendingFollowUp.delete(key);
  }
};

export type ChatIntent = "FOOD" | "RESTAURANT_INFO" | "ORDER_GUIDE" | "OUT_OF_SCOPE";

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
  return value ? `11. Quy tắc bổ sung của nhà hàng: ${value}` : "";
};

// ---------------------------------------------------------------------------
// Intent + nhanh tra loi
// ---------------------------------------------------------------------------

const isOrderGuideQuestion = (p: string): boolean =>
  [
    "cach dat", "dat mon", "dat hang", "thanh toan", "huy don", "don hang",
    "trang thai don", "theo doi don", "xem don", "don cua toi", "giao hang the nao",
  ].some((k) => p.includes(k));

const isRestaurantInfoQuestion = (p: string): boolean =>
  [
    "mo cua", "dong cua", "gio mo", "gio dong", "o dia chi", "dia chi",
    "phi ship", "thoi gian giao", "giao hang o dau", "quan o dau", "sdt", "so dien thoai",
  ].some((k) => p.includes(k));

export const guideReply =
  () =>
    "Để đặt món, bạn thêm món vào giỏ rồi vào trang thanh toán. Khách vãng lai cần đăng nhập mới thêm được vào giỏ.\n\n"
    + "- Chỉ hủy được đơn đang CHỜ (PENDING) và CHƯA thanh toán (UNPAID). Đơn đã hoàn thành hoặc đã hủy không sửa được.\n"
    + "- Trạng thái PREPARING hiện là \"Đang vận chuyển\". Bạn xem trạng thái đơn ở mục Đơn hàng của bạn.\n\n"
    + "Nếu cần, mình cũng gợi ý món theo ngân sách. Bạn cho mình biết số người ăn nhé!";

export const declineReply =
  () =>
    "Mình chỉ tư vấn được về món ăn của quán (gợi ý món, thông tin quán, hướng dẫn đặt hàng). "
    + "Bạn muốn mình gợi ý món cho mấy người, hoặc hỏi giờ mở cửa/shipping thì cứ nhắn nhé!";

const truncate = (s: string, max: number): string => {
  const t = s.replaceAll(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trim()}...`;
};

const isDifferentRequest = (message: string): boolean => {
  const p = plain(message).replaceAll(/[^\p{L}\p{N} ]+/gu, " ").replaceAll(/\s+/g, " ").trim();
  return ["mon khac", "mon khac di", "khac di", "doi mon khac", "mon khac nha", "mon khac khong"].includes(p);
};

const isWaitingFollowUpAnswer = (message: string): boolean => {
  const trimmed = message.trim();
  const bare = BARE_NUMBER.exec(trimmed);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 1 && n <= 50;
  }
  return parsePeople(trimmed) !== null || parseBudget(trimmed) !== null;
};

/** Gop cau tra loi gon ("2", "200k") voi cau hoi goc dang cho; khong gop neu khach doi chu de. */
const resolveFollowUpAnswer = (sessionId: string, message: string): { message: string; continued: boolean } => {
  prunePendingFollowUp();
  const pending = pendingFollowUp.get(sessionId);
  if (!pending) return { message, continued: false };
  if (pending.expiresAtMs <= Date.now()) {
    pendingFollowUp.delete(sessionId);
    return { message, continued: false };
  }
  const answer = isWaitingFollowUpAnswer(message) ? message : null;
  if (answer === null) {
    pendingFollowUp.delete(sessionId);
    return { message, continued: false };
  }
  pendingFollowUp.delete(sessionId);
  return { message: `${pending.originalMessage} ${answer}`, continued: true };
};

/** Giai quyet dai tu tham chieu: ghep ten cac mon vua goi y vao de AI trich tieu chi chinh xac hon. */
const enrichWithLastPicked = (message: string, lastFoodIds: number[] | undefined | null, menu: FoodWithCategory[]): string => {
  if (!isFollowUp(message) || !lastFoodIds?.length) return message;
  const names = menu.filter((f) => lastFoodIds.includes(f.id)).map((f) => f.name);
  if (names.length === 0) return message;
  return `Dựa trên các món vừa gợi ý: ${names.join(", ")}. ${message}`;
};

/** Hoi follow-up tung buoc cho cau hoi qua chung; null neu nen goi y ngay. */
const followUpQuestion = (message: string, filters: Filters, menu: FoodWithCategory[]): string | null => {
  const p = plain(message);
  if (p.includes("tuy ban") || p.includes("goi y luon") || p.includes("cu") || p.includes("ngon la duoc")) return null;
  if (filters.people != null || filters.budget != null) return null;
  if (filters.chay || filters.maxSpicyLevel != null || filters.excludeSeafood || filters.spicyRequired) return null;
  if (!isFoodQuestion(p)) return null;
  const q = p.toLowerCase();
  const hasDishWord = menu.some((f) => f.name && plain(f.name).length > 3 && q.includes(plain(f.name)));
  if (hasDishWord) return null;
  return "Bạn đang muốn ăn cho mấy người? (Ví dụ: 2 người)";
};

/** ID cac mon duoc dung lam ngu canh cho luot nay, hoac null neu phai tim tren toan thuc don. */
const contextIds = (
  message: string,
  lastFoodIds: number[] | undefined | null,
  criteria: NormalizedCriteria | null,
  categoryNamesPlain: string[],
): number[] | null => {
  if (!isFollowUp(message) || !lastFoodIds?.length) return null;
  const newTopic = criteria ? hasNewTopic(criteria) : hasNewTopicByCode(message, categoryNamesPlain);
  return newTopic ? null : lastFoodIds;
};

const hasNewTopic = (c: NormalizedCriteria): boolean => {
  if (c.categories?.length) return true;
  if (c.dietaryTags?.length) return true;
  if (c.excludeAllergens?.length) return true;
  return !!c.keywords?.some((k) => !isReferenceKeyword(k));
};

const hasNewTopicByCode = (question: string, categoryNamesPlain: string[]): boolean => {
  const filters = readFilters(question);
  if (filters.chay || filters.excludeSeafood) return true;
  const p = plain(question);
  return categoryNamesPlain.some((name) => p.includes(name));
};

/** Ghep rang buoc khach neu van tat trong cau tra loi ("2", "200k") vao tieu chi AI trich. */
const withAnsweredConstraints = (c: NormalizedCriteria, message: string): NormalizedCriteria => {
  const bare = BARE_NUMBER.exec(message.trim());
  const barePeople = bare?.[1] ? Number(bare[1]) : null;
  const people = parsePeople(message) ?? barePeople;
  const budget = parseBudget(message);
  return {
    ...c,
    maxBudget: c.maxBudget ?? budget,
    people: c.people ?? people,
  };
};

const requestHistory = (history: string[] | undefined | null): string[] => {
  if (!history) return [];
  return history.map((s) => s.trim()).filter(Boolean).slice(0, 3);
};

// ---------------------------------------------------------------------------
// Goi AI + kiem tra + chon mon
// ---------------------------------------------------------------------------

/** Trich tieu chi bang AI; loi khoa -> AiKeyRejectedException (chat() doi thanh 503); loi khac -> null. */
const extractCriteria = async (message: string, history: string[], categoryNames: string): Promise<NormalizedCriteria | null> => {
  const previous = history.length ? history.join("\n") : "(không có)";
  const prompt = EXTRACT_PROMPT.replace("%s", previous).replace("%s", categoryNames);
  let raw: string;
  try {
    raw = await gemini.generate(prompt, message, true);
  } catch (error) {
    if (error instanceof gemini.AiKeyRejectedException) throw error;
    return null;
  }
  const cleaned = raw.replaceAll("```json", "").replaceAll("```", "").trim();
  try {
    const parsed = criteriaSchema.parse(JSON.parse(cleaned));
    return normalizeCriteria(parsed);
  } catch {
    return null;
  }
};

/** Sinh cau tra loi tu danh sach mon da loc; loi khoa -> AiKeyRejectedException; loi khac -> null. */
const generateReply = async (
  question: string,
  criteria: NormalizedCriteria,
  foods: Picked[],
  history: string[],
): Promise<string | null> => {
  const data: string[] = [];
  if (history.length) {
    data.push("CÁC CÂU HỎI TRƯỚC CỦA KHÁCH:");
    for (const h of history) data.push(`- ${h}`);
    data.push("");
  }
  data.push(`YÊU CẦU ĐÃ PHÂN TÍCH: ${JSON.stringify(criteria ?? {})}`);
  data.push("");
  data.push("DANH SÁCH MÓN PHÙ HỢP (dữ liệu thật từ thực đơn):");
  if (foods.length === 0) data.push("(rỗng)");
  for (const p of foods.slice(0, 15)) {
    const f = p.food;
    data.push(
      `- ${f.name} | loại: ${f.category?.name ?? ""} | giá: ${Number(f.price)} VND/phần | khẩu phần: ${f.servingSize} người | cần: ${p.portions} phần | tổng: ${p.totalPrice} VND | cay: ${f.spicyLevel}/3 | nguyên liệu: ${f.ingredients ?? "không có"} | dị ứng: ${f.allergens ?? "không có"} | nhãn: ${f.dietaryTags ?? "không có"} | mô tả: ${f.description ?? "không có"}`,
    );
  }
  const total = foods.reduce((sum, p) => sum + p.totalPrice, 0);
  data.push("");
  data.push(`TỔNG BỘ GỢI Ý: ${total} VND`);
  if (criteria.maxBudget != null) data.push(`NGÂN SÁCH: ${criteria.maxBudget} VND`);
  data.push(`CÂU HỎI CỦA KHÁCH: ${question}`);

  try {
    return await gemini.generate(
      ANSWER_PROMPT.replace("%s", await extraRules()),
      data.join("\n"),
      false,
    );
  } catch (error) {
    if (error instanceof gemini.AiKeyRejectedException) throw error;
    return null;
  }
};

const saveMessage = async (
  userId: number,
  sessionId: string,
  sender: "USER" | "BOT",
  content: string,
) => {
  await db.insert(chatMessages).values({ userId, sessionId, sender, content });
};

export const chatbotStatus = async () => {
  const available = await gemini.verifyKey();
  return { available, notice: available ? null : MISSING_KEY_NOTICE };
};

const requireConfigured = () => {
  if (!gemini.isConfigured()) {
    throw new HttpError(503, MISSING_KEY_NOTICE);
  }
};

// ---------------------------------------------------------------------------
// Luong chinh
// ---------------------------------------------------------------------------

// Luong chatbot: hai luot goi AI, bon buoc xu ly chong AI bia mon/gia.
// The mon tra ve client lay ID/gia tu DB; chi khach da dang nhap moi luu lich su.
export const chat = async (
  email: string | null,
  input: { message: string; sessionId?: string; history?: string[]; lastFoodIds?: number[] },
): Promise<ChatResponseBody> => {
  requireConfigured();

  const sessionId = input.sessionId?.trim() || randomUUID();
  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;
  const history = requestHistory(input.history);
  if (user) await saveMessage(user.id, sessionId, "USER", input.message);

  const resolved = resolveFollowUpAnswer(sessionId, input.message);
  const classifyMessage = resolved.message;

  const menu = await db.query.foods.findMany({ with: { category: true } });
  const workingMessage = enrichWithLastPicked(classifyMessage, input.lastFoodIds, menu);

  const p = plain(classifyMessage);
  const maxSugg = await maxSuggestions();

  // Thong tin quan: tra loi tu tai lieu admin nhap, khong goi AI de tranh bia.
  if (isRestaurantInfoQuestion(p)) {
    const chunks = await searchChunks(input.message, 5);
    let reply: string;
    let citations: Array<{ sourceName: string; snippet: string }> | null = null;
    if (chunks.length > 0) {
      reply = chunks.map((c) => `- ${truncate(c.chunk.content, 400)}`).join("\n");
      citations = chunks.map((c: ScoredChunk) => ({
        sourceName: c.document?.title ?? "Tài liệu quán",
        snippet: truncate(c.chunk.content, 120),
      }));
    } else {
      const docs = await keywordSearchKnowledge(input.message);
      if (docs.length === 0) {
        reply = "Mình chưa có thông tin xác thực về mục này trong tài liệu của quán. Bạn xem thực đơn bên dưới hoặc hỏi nhân viên nhé!";
      } else {
        reply = docs.map((d) => `- ${(d.content ?? "").trim()}`).join("\n");
        citations = docs.map((d) => ({ sourceName: d.title ?? "Tài liệu quán", snippet: truncate(d.content ?? "", 120) }));
      }
    }
    if (user) await saveMessage(user.id, sessionId, "BOT", reply);
    return { reply, foods: [], intent: "RESTAURANT_INFO", citations, quickReplies: QR_INFO };
  }

  // Huong dan dat hang: quy trinh co dinh bang code, khong goi AI.
  if (isOrderGuideQuestion(p)) {
    const reply = guideReply();
    if (user) await saveMessage(user.id, sessionId, "BOT", reply);
    return { reply, foods: [], intent: "ORDER_GUIDE", citations: null, quickReplies: QR_GUIDE };
  }

  const genericInfoMatch = !isFoodQuestion(p) && !isFollowUp(classifyMessage) && !p.includes("goi y") && !p.includes("mon");
  const docChunks = genericInfoMatch ? await searchChunks(input.message, 5) : [];
  if (genericInfoMatch && docChunks.length > 0) {
    const reply = docChunks.map((c) => `- ${truncate(c.chunk.content, 400)}`).join("\n");
    const citations = docChunks.map((c) => ({
      sourceName: c.document?.title ?? "Tài liệu quán",
      snippet: truncate(c.chunk.content, 120),
    }));
    if (user) await saveMessage(user.id, sessionId, "BOT", reply);
    return { reply, foods: [], intent: "RESTAURANT_INFO", citations, quickReplies: QR_INFO };
  }

  if (genericInfoMatch && docChunks.length === 0) {
    const reply = declineReply();
    if (user) await saveMessage(user.id, sessionId, "BOT", reply);
    return { reply, foods: [], intent: "OUT_OF_SCOPE", citations: null, quickReplies: QR_DECLINE };
  }

  // "Mon khac" (khach bam nut): do code quyet dinh, khong goi AI.
  if (isDifferentRequest(input.message)) {
    const exclude = input.lastFoodIds ?? [];
    const fresh = menu
      .filter((f) => f.available && !exclude.includes(f.id))
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, maxSugg)
      .map((f) => ({ food: f, portions: 1, totalPrice: Number(f.price) }));
    const reply = fresh.length === 0
      ? "Mình chưa còn món nào khác phù hợp; bạn thử nói rõ hơn khẩu vị hoặc ngân sách nhé!"
      : "Mình gợi ý một vài món khác, bấm vào thẻ để xem chi tiết nhé!";
    if (user) await saveMessage(user.id, sessionId, "BOT", reply);
    return { reply, foods: fresh.map(toCard), intent: "FOOD", citations: null, quickReplies: fresh.length ? QR_FOOD : QR_FOOD_EMPTY };
  }

  // FOOD: hoi follow-up tung buoc cho cau hoi qua chung cua nguoi moi.
  const earlyFilters = readFilters(classifyMessage);
  const followUp = followUpQuestion(classifyMessage, earlyFilters, menu);
  if (followUp !== null) {
    if (user) await saveMessage(user.id, sessionId, "BOT", followUp);
    pendingFollowUp.set(sessionId, { originalMessage: input.message, expiresAtMs: Date.now() + FOLLOW_UP_TTL_MS });
    return { reply: followUp, foods: [], intent: "FOOD", citations: null, quickReplies: QR_FOLLOWUP };
  }

  const categoryNames = [...new Set(menu.map((f) => f.category?.name).filter((n): n is string => !!n))];
  const categoryNamesPlain = categoryNames.map((n) => plain(n));
  const categoryNamesText = categoryNames.join(", ");

  let criteria: NormalizedCriteria | null = null;
  let context: number[] | null = null;
  let aiPicked: Picked[] = [];
  let aiReply: string | null = null;
  try {
    criteria = await extractCriteria(workingMessage, history, categoryNamesText);
    if (resolved.continued && criteria) {
      criteria = withAnsweredConstraints(criteria, input.message);
    }
    context = contextIds(classifyMessage, input.lastFoodIds, criteria, categoryNamesPlain);
    aiPicked = criteria == null ? [] : selectFoods(criteria, context, menu, maxSugg);
    aiReply = criteria == null ? null : await generateReply(input.message, criteria, aiPicked, history);
  } catch (error) {
    if (error instanceof gemini.AiKeyRejectedException) {
      throw new HttpError(503, MISSING_KEY_NOTICE);
    }
    throw error;
  }

  let picked: Picked[];
  let reply: string;
  if (aiReply !== null) {
    picked = aiPicked;
    reply = aiReply;
  } else {
    const filters = readFilters(classifyMessage);
    if (context !== null) {
      picked = selectContextByCode(context, filters, menu);
    } else {
      picked = aiPicked.length > 0 ? aiPicked : selectFoodsByCode(workingMessage, filters, menu, maxSugg);
    }
    reply = fallbackReply(picked, filters);
  }

  if (user) await saveMessage(user.id, sessionId, "BOT", reply);
  const cards = picked.slice(0, maxSugg).map(toCard);
  return {
    reply,
    foods: cards,
    intent: "FOOD",
    citations: null,
    quickReplies: cards.length > 0 ? QR_FOOD : QR_FOOD_EMPTY,
  };
};
