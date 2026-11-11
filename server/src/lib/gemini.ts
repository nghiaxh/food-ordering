// Lớp DUY NHẤT gọi API AI; đổi nhà cung cấp chỉ cần thay file này.
// Provider và tên mô hình đọc từ bảng cấu hình `ai_setting` (admin đặt trong trang Chatbot),
// chỉ fallback về biến môi trường khi chưa đặt. Không log khóa, không trả khóa về client.

import { eq } from "drizzle-orm";
import { aiSetting } from "../db/schema.js";
import { db } from "./db.js";
import { env } from "../config/env.js";

export const PROVIDER_GEMINI = "gemini";
export const PROVIDER_OPENAI = "openai";
export const SUPPORTED_PROVIDERS = [PROVIDER_GEMINI, PROVIDER_OPENAI] as const;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 15_000;
const PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
const PROBE_USER = "ping";
const PROBE_RETRY_MS = 5 * 60 * 1000;

/** Khóa API bị nhà cung cấp từ chối (sai, hết hạn, chưa bật API) — không phải lỗi tạm thời. */
export class AiKeyRejectedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiKeyRejectedException";
  }
}

let credentialsRejected = false;
let keyAccepted: boolean | null = null;
let probeFailedAt = 0;

/** Trợ lý có dùng được không: khóa đã cấu hình và chưa bị nhà cung cấp từ chối. */
export const isConfigured = (): boolean => {
  const apiKey = env.AI_API_KEY;
  return !!apiKey && apiKey.trim().length > 0 && !credentialsRejected;
};

/** Reset bộ nhớ cache — chỉ dùng trong test hoặc khi khởi động lại tiến trình. */
export const _resetKeyStateForTests = () => {
  credentialsRejected = false;
  keyAccepted = null;
  probeFailedAt = 0;
};

const setting = async (key: string, fallback: string): Promise<string> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, key) });
  const value = row?.settingValue?.trim();
  return value ? value : fallback;
};

const fetchWithTimeout = (url: string, init: RequestInit): Promise<Response> =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Khóa có được nhà cung cấp chấp nhận không. Lần đầu gọi thử một câu tối giản rồi giữ kết quả. */
export const verifyKey = async (): Promise<boolean> => {
  if (!isConfigured()) return false;
  if (keyAccepted !== null) return keyAccepted;
  if (Date.now() - probeFailedAt < PROBE_RETRY_MS) return true;
  try {
    await generate(PROBE_SYSTEM, PROBE_USER, false);
    keyAccepted = true;
    return true;
  } catch (error) {
    if (error instanceof AiKeyRejectedException) {
      credentialsRejected = true;
      return false;
    }
    // Lỗi mạng/quota: coi như dùng được, chỉ thử lại sau một lúc.
    probeFailedAt = Date.now();
    return true;
  }
};

const isKeyRejectionBody = (status: number, body: string): boolean => {
  if (status === 401 || status === 403) return true;
  return (
    body.includes("API_KEY_INVALID") ||
    body.includes("API key not valid") ||
    body.includes("invalid_api_key") ||
    body.includes("Incorrect API key")
  );
};

/** Gọi dịch vụ AI; lỗi tạm thời thì ném RuntimeException để chatbot tự rơi sang nhánh dự phòng. */
export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<string> => {
  const provider = (await setting("provider", env.AI_PROVIDER)).toLowerCase();
  const model = await setting("model", env.AI_MODEL);
  const apiKey = env.AI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Chưa cấu hình khóa API của dịch vụ AI");
  }

  try {
    const raw =
      provider === PROVIDER_OPENAI
        ? await callOpenAI(apiKey, model, systemPrompt, userPrompt, jsonMode)
        : await callGemini(apiKey, model, systemPrompt, userPrompt, jsonMode);
    return text(provider, raw);
  } catch (error) {
    if (isKeyRejected(error)) {
      credentialsRejected = true;
      throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", { cause: error });
    }
    throw new Error(`Không gọi được dịch vụ AI: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

const isKeyRejected = (error: unknown): boolean => {
  if (error instanceof AiKeyRejectedException) return true;
  const body = typeof error === "object" && error !== null && "body" in error
    ? String((error as { body?: unknown }).body ?? "")
    : "";
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : NaN;
  return Number.isFinite(status) && isKeyRejectionBody(status, body);
};

interface HttpError extends Error {
  status?: number;
  body?: string;
}

const httpError = (status: number, body: string): HttpError => {
  const error = new Error(`HTTP ${status}`) as HttpError;
  error.status = status;
  error.body = body;
  return error;
};

const callGemini = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<string> => {
  const generationConfig = jsonMode
    ? { temperature: 0.2, responseMimeType: "application/json" }
    : { temperature: 0.4 };
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig,
  };
  const response = await fetchWithTimeout(
    `${GEMINI_URL}${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw httpError(response.status, await response.text());
  return response.text();
};

const callOpenAI = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<string> => {
  const body: Record<string, unknown> = {
    model,
    temperature: jsonMode ? 0.2 : 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const response = await fetchWithTimeout(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw httpError(response.status, await response.text());
  return response.text();
};

/** Đọc text từ cấu trúc phản hồi; mỗi nhà cung cấp một vị trí khác nhau. */
const text = (provider: string, raw: string): string => {
  try {
    const root = JSON.parse(raw) as Record<string, unknown>;
    if (provider === PROVIDER_OPENAI) {
      const choices = root.choices as Array<{ message?: { content?: string } }> | undefined;
      return choices?.[0]?.message?.content ?? "";
    }
    const candidates = root.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string }> } }>
      | undefined;
    return candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    return "";
  }
};
