// Lop DUY NHAT goi API AI; doi nha cung cap chi can thay file nay.
// Provider va ten mo hinh doc tu bang cau hinh `ai_setting` (admin dat trong trang Chatbot),
// chi fallback ve bien moi truong khi chua dat. Khong log khoa, khong tra khoa ve client.

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

/** Khoa API bi nha cung cap tu choi (sai, het han, chua bat API) — khong phai loi tam thoi. */
export class AiKeyRejectedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiKeyRejectedException";
  }
}

let credentialsRejected = false;
let keyAccepted: boolean | null = null;
let probeFailedAt = 0;

/** Tro ly co dung duoc khong: khoa da cau hinh va chua bi nha cung cap tu choi. */
export const isConfigured = (): boolean => {
  const apiKey = env.AI_API_KEY;
  return !!apiKey && apiKey.trim().length > 0 && !credentialsRejected;
};

/** Reset bo nho cache — chi dung trong test hoac khi khoi dong lai tien trinh. */
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

/** Khoa co duoc nha cung cap chap nhan khong. Lan dau goi thu mot cau toi gian roi giu ket qua. */
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
    // Loi mang/quota: coi nhu dung duoc, chi thu lai sau mot luc.
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

/** Goi dich vu AI; loi tam thoi thi nem RuntimeException de chatbot tu roi sang nhanh du phong. */
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

/** Doc text tu cau truc phan hoi; moi nha cung cap mot vi tri khac nhau. */
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
