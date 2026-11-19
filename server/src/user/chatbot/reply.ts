import { HttpError } from "../../lib/errors.js";
import * as provider from "../../lib/provider.js";
import { plain } from "../../lib/text-normalizer.js";
import { dropTrailingQuestion, hasForeignScript, limitSentences } from "./grounding.js";
import { searchChunks, type ScoredChunk } from "./retrieval.js";
import { CHAT_PROMPT } from "./prompts.js";
import { filterMenu, buildCards, quickRepliesFor } from "./select.js";
import type { FoodWithCategory } from "./constraints.js";
import type { Criteria, ParsedQuery } from "./parse.js";

export interface ReplyResult {
  reply: string;
  pickedIds: number[];
  citations: Array<{ sourceName: string; snippet: string }> | null;
}

const truncate = (s: string, max: number): string => {
  const t = s.replaceAll(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trim()}...`;
};

export const validPicked = (ids: unknown, candidates: FoodWithCategory[], max: number): FoodWithCategory[] => {
  if (!Array.isArray(ids)) return [];
  const idSet = new Set(candidates.map((c) => c.id));
  const chosen: FoodWithCategory[] = [];
  const seen = new Set<number>();
  for (const raw of ids) {
    const id = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(id) || seen.has(id) || !idSet.has(id)) continue;
    seen.add(id);
    const food = candidates.find((c) => c.id === id);
    if (food) chosen.push(food);
    if (chosen.length >= max) break;
  }
  return chosen;
};

export const safeReply = (raw: string, picked: FoodWithCategory[]): string => {
  const cleaned = raw
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const foreign = hasForeignScript(cleaned);
  if (foreign) {
    // Khong retry (1 request/luot): dung template an toan.
    return templateReply(picked);
  }
  const reply = limitSentences(dropTrailingQuestion(cleaned));
  if (!reply) return templateReply(picked);
  return reply;
};

const templateReply = (picked: FoodWithCategory[]): string => {
  if (picked.length === 0) {
    return "Mình chưa tìm thấy món phù hợp với điều kiện này. Quý khách thử nới ngân sách, độ cay hoặc chế độ ăn nhé.";
  }
  return "Mình gợi ý các món dưới đây. Quý khách bấm vào thẻ món để xem chi tiết và đặt món.";
};

export const composeFoodReply = async (
  message: string,
  candidates: FoodWithCategory[],
  history: string[],
  maxSugg: number,
  extraRules: string,
): Promise<{ reply: string; picked: FoodWithCategory[] }> => {
  const menuText = candidates
    .map((f) => `${f.id}|${f.name} - ${Number(f.price).toLocaleString("vi-VN")}đ - ${f.category?.name ?? "món"} - cay ${f.spicyLevel}`)
    .join("\n");
  const historyText = history.length > 0 ? history.join("\n") : "(không có)";
  const lastIds = ""; // caller truyen qua criteria? placeholder
  const prompt = CHAT_PROMPT
    .replace("%s", menuText || "(trống)")
    .replace("%s", "(không có)")
    .replace("%s", String(maxSugg))
    .replace("%s", historyText)
    .replace("%s", lastIds)
    .replace("%s", extraRules || "(không có)");

  let raw: string;
  try {
    raw = await provider.generate(prompt, message, true, {
      timeoutMs: provider.AI_TIMEOUTS.reply,
      maxOutputTokens: provider.AI_MAX_OUTPUT_TOKENS,
    });
  } catch (e) {
    if (e instanceof provider.AiRateLimitedException) throw new HttpError(429, "Quá nhiều yêu cầu, quý khách vui lòng thử lại sau ít phút.");
    console.warn(`[ai] goi y mon that bai: ${e instanceof Error ? e.message : String(e)}`);
    throw new HttpError(502, "Trợ lý AI đang gặp sự cố, quý khách vui lòng thử lại sau ít phút.");
  }

  const cleaned = raw.replaceAll("```json", "").replaceAll("```", "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
  let parsedJson: { reply?: string; pickedIds?: unknown };
  try {
    parsedJson = JSON.parse(jsonStr);
  } catch {
    throw new HttpError(502, "Trợ lý AI chưa trả lời được, quý khách vui lòng thử lại.");
  }

  const picked = validPicked(parsedJson.pickedIds, candidates, maxSugg);
  const reply = safeReply(String(parsedJson.reply ?? ""), picked);
  return { reply, picked };
};

export const composeInfoReply = async (message: string): Promise<{ reply: string; citations: Array<{ sourceName: string; snippet: string }> | null }> => {
  const chunks = await searchChunks(message, 5);
  const reply = chunks.length > 0
    ? chunks.map((c) => `- ${truncate(c.chunk.content, 400)}`).join("\n")
    : "Tôi chưa có thông tin xác thực về mục này trong tài liệu của quán.";
  const citations = chunks.length > 0 ? chunks.map((c: ScoredChunk) => ({ sourceName: c.document?.title ?? "Tài liệu quán", snippet: truncate(c.chunk.content, 120) })) : null;
  return { reply, citations };
};

export const composeStaticReply = (intent: string): string => {
  if (intent === "ORDER_GUIDE") {
    return "Để đặt món, quý khách thêm món vào giỏ rồi vào trang thanh toán. Thanh toán COD hoặc quét QR đều được.\n\n- Chỉ hủy được đơn đang chờ xử lý và chưa thanh toán.\n- Đơn đã hoàn thành hoặc đã hủy thì không thể sửa.\n- Khi đơn ở trạng thái \"Đang vận chuyển\", quán đang giao hàng cho quý khách.\n- Quý khách xem trạng thái đơn ở mục Đơn hàng của mình.";
  }
  if (intent === "GREETING") {
    return "Chào quý khách! Tôi là trợ lý của quán. Tôi có thể gợi ý món theo ngân sách/số người, thông tin quán và hướng dẫn đặt món.";
  }
  if (intent === "THANKS") {
    return "Rất vui được hỗ trợ quý khách. Khi cần gợi ý món, quý khách cứ nhắn số người và ngân sách nhé!";
  }
  if (intent === "CONFIRM") {
    return "Quý khách muốn xác nhận gì ạ? Nếu muốn đặt món, quý khách bấm vào thẻ món rồi thêm vào giỏ nhé!";
  }
  if (intent === "OUT_OF_SCOPE") {
    return "Tôi chỉ tư vấn về món ăn của quán: gợi ý món theo số người, ngân sách, khẩu vị, thông tin quán và cách đặt món. Quý khách thử hỏi lại theo các mục đó nhé.";
  }
  return "";
};

export { filterMenu, buildCards, quickRepliesFor };