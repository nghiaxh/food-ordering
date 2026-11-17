import { eq } from "drizzle-orm";
import { aiSetting } from "../db/schema.js";
import { db } from "./db.js";
import { env } from "../config/env.js";

// Lop duy nhat goi API AI. Doi nha cung cap chi can sua file nay.
// Provider/model doc tu bang cau hinh `ai_setting`, chi fallback ve bien moi truong khi chua dat.
// Khong log khoa va khong tra khoa ve client.
export const PROVIDER_GEMINI = "gemini";
export const SUPPORTED_PROVIDERS = [PROVIDER_GEMINI] as const;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const TIMEOUT_MS = 15_000;
const EXTRACT_TIMEOUT_MS = 10_000;
const REPLY_TIMEOUT_MS = 12_000;
const EMBED_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 500;
export const EMBEDDING_DIM = 768;
const PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
const PROBE_USER = "ping";
const PROBE_RETRY_MS = 5 * 60 * 1000;

// Provider rat hanh ban: 429 la loi tam thoi, thu lai sau it giay se duoc.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [600, 1800];
const RETRY_AFTER_CAP_MS = 5_000;
// Sau 429 dung goi AI trong mot luc de khong doi gap hanh che.
const RATE_LIMIT_COOLDOWN_MS = 25_000;

/** Khoa API bi nha cung cap tu choi (sai, het han, chua bat API) - khong phai loi tam thoi. */
export class AiKeyRejectedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiKeyRejectedException";
  }
}

/** Provider da chon ban (429): dung goi AI mot luc roi thu lai. */
export class AiRateLimitedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRateLimitedException";
  }
}

let credentialsRejected = false;
let keyAccepted: boolean | null = null;
let probeFailedAt = 0;
let rateLimitedUntil = 0;

/** Provider dang gioi han: client can bao ngay thay vi cho lau. */
export const isRateLimited = (): boolean => Date.now() < rateLimitedUntil;

/** Tro ly co dung duoc khong: khoa da cau hinh va chua bi nha cung cap tu choi. */
export const isConfigured = (): boolean => {
  const apiKey = env.AI_API_KEY;
  return !!apiKey && apiKey.trim().length > 0 && !credentialsRejected;
};

/** Reset bo nho cache - chi dung trong test hoac khi khoi dong lai tien trinh. */
export const _resetKeyStateForTests = () => {
  credentialsRejected = false;
  keyAccepted = null;
  probeFailedAt = 0;
  rateLimitedUntil = 0;
};

const setting = async (key: string, fallback: string): Promise<string> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, key) });
  const value = row?.settingValue?.trim();
  return value ? value : fallback;
};

const fetchWithTimeout = (url: string, init: RequestInit, timeoutMs: number): Promise<Response> =>
  fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

/** Khoa co duoc nha cung cap chap nhan khong. Lan dau goi thu mot cau toi gian roi giu ket qua. */
export const verifyKey = async (): Promise<boolean> => {
  if (!isConfigured()) return false;
  if (keyAccepted !== null) return keyAccepted;
  if (Date.now() - probeFailedAt < PROBE_RETRY_MS) return true;
  try {
    await generate(PROBE_SYSTEM, PROBE_USER, false, { timeoutMs: 8_000, maxOutputTokens: 16 });
    keyAccepted = true;
    return true;
  } catch (error) {
    if (error instanceof AiKeyRejectedException) {
      credentialsRejected = true;
      keyAccepted = false;
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
    body.includes("API key not valid")
  );
};

export interface GenerateOptions {
  /** Timeout cho mot lan goi; mac dinh dung TIMEOUT_MS. */
  timeoutMs?: number;
  /** Gioi han so token sinh ra, giup model nem xong nhanh hon. */
  maxOutputTokens?: number;
}

/** Goi dich vu AI; loi tam thoi thi nem RuntimeException de chatbot tu roi sang nhanh du phong. */
export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: GenerateOptions = {},
): Promise<string> => {
  const provider = (await setting("provider", env.AI_PROVIDER)).toLowerCase();
  if (provider !== PROVIDER_GEMINI) {
    throw new Error("Nhà cung cấp AI không được hỗ trợ");
  }
  const model = await setting("model", env.AI_MODEL);
  const apiKey = env.AI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Chưa cấu hình khóa API của dịch vụ AI");
  }
  // Trong luc cho doi hanh che, khong goi provider: tra loi nhanh cho client.
  if (Date.now() < rateLimitedUntil) {
    throw new AiRateLimitedException("Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau");
  }

  try {
    const raw = await callGemini(apiKey, model, systemPrompt, userPrompt, jsonMode, options);
    return text(raw);
  } catch (error) {
    if (error instanceof AiRateLimitedException) throw error;
    if (isKeyRejected(error)) {
      credentialsRejected = true;
      keyAccepted = false;
      throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", { cause: error });
    }
    throw new Error(`Không gọi được dịch vụ AI: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

/** Sinh vector embedding cho mot doan van ban. Tra ve null neu khong cau hinh duoc. */
export const embed = async (text: string): Promise<number[] | null> => {
  const results = await embedBatch([text]);
  return results[0] ?? null;
};

/** Sinh vector embedding cho nhieu doan van ban (loi 16 input/request). Tra ve null cho input loi. */
export const embedBatch = async (texts: string[]): Promise<Array<number[] | null>> => {
  if (!isConfigured()) return texts.map(() => null);
  if (texts.length === 0) return [];

  const apiKey = env.AI_API_KEY;
  const model = await setting("embedding_model", "gemini-embedding-2");
  const results: Array<number[] | null> = new Array(texts.length).fill(null);

  // Chia lo 16 input
  const batchSize = 16;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const requests = batch.map((t) => ({
      model: `models/${model}`,
      content: { parts: [{ text: `title: none | text: ${t}` }] },
      outputDimensionality: EMBEDDING_DIM,
    }));

    try {
      const response = await fetchWithTimeout(
        `${GEMINI_URL}${model}:batchEmbedContents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ requests }),
        },
        EMBED_TIMEOUT_MS,
      );

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 401 || response.status === 403 || body.includes("API_KEY_INVALID")) {
          credentialsRejected = true;
        }
        console.warn(`[ai] embed loi ${response.status}`);
        continue;
      }

      const json = await response.json() as { embeddings?: Array<{ values?: number[] }> };
      const embeddings = json.embeddings ?? [];
      for (let j = 0; j < batch.length; j++) {
        const vals = embeddings[j]?.values;
        if (vals && vals.length === EMBEDDING_DIM) {
          results[i + j] = vals;
        }
      }
      // Thanh cong thi bo hanh cho doi
      rateLimitedUntil = 0;
    } catch (error) {
      console.warn(`[ai] embed exception: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return results;
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
  retryAfterMs?: number;
}

const httpError = (status: number, body: string, retryAfterMs?: number): HttpError => {
  const error = new Error(`HTTP ${status}`) as HttpError;
  error.status = status;
  error.body = body;
  error.retryAfterMs = retryAfterMs;
  return error;
};

const statusOf = (error: unknown): number => {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : NaN;
  return Number.isFinite(status) ? status : 0;
};

/** Doc `Retry-After` (giay hoac ngay HTTP) va doi thanh mili giay, gioi han toi da cap. */
const retryAfterMs = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0) * 1000, RETRY_AFTER_CAP_MS);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), RETRY_AFTER_CAP_MS);
  return undefined;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Goi provider co retry lai loi tam thoi. 429/5xx thi thu them (toi da 2 lan) theo
 * backoff ngan va ton trong `Retry-After`; het luot thi nem loi de chatbot roi sang
 * nhanh du phong. Loi khoa khong retry.
 */
const callGemini = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: GenerateOptions,
): Promise<string> => {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callOnce(
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        jsonMode,
        timeoutMs,
        options.maxOutputTokens,
      );
      // Lan thu lai thanh cong thi provider da cho qua: bo hanh cho doi.
      rateLimitedUntil = 0;
      return raw;
    } catch (error) {
      lastError = error;
      const status = statusOf(error);
      if (status === 429) {
        // Chan goi moi trong chot, khong phai chi loi cua lan nay.
        rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn("[ai] provider tra 429, tam dung goi AI 25s");
      }
      if (!RETRYABLE_STATUS.has(status) || attempt === MAX_RETRIES) break;
      const hinted = (error as HttpError | undefined)?.retryAfterMs;
      const wait = hinted ?? RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      console.warn(`[ai] provider loi ${status}, thu lai sau ${wait}ms`);
      await sleep(wait);
    }
  }
  if (statusOf(lastError) === 429) {
    throw new AiRateLimitedException("Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau", {
      cause: lastError,
    });
  }
  throw lastError;
};

const callOnce = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  timeoutMs: number,
  maxOutputTokens?: number,
): Promise<string> => {
  const generationConfig: { temperature: number; responseMimeType?: string; maxOutputTokens?: number } = jsonMode
    ? { temperature: 0.2, responseMimeType: "application/json" }
    : { temperature: 0.4 };
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
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
    timeoutMs,
  );
  if (!response.ok) {
    throw httpError(response.status, await response.text(), retryAfterMs(response.headers.get("retry-after")));
  }
  return response.text();
};

/** Doc text tu cau truc phan hoi Gemini. */
const text = (raw: string): string => {
  try {
    const root = JSON.parse(raw) as Record<string, unknown>;
    const candidates = root.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string }> } }>
      | undefined;
    return candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    return "";
  }
};

/** Timeout rieng cho tung buoc: trich xuat phai nhanh, sinh cau tra loi dai hon mot chut. */
export const AI_TIMEOUTS = { extract: EXTRACT_TIMEOUT_MS, reply: REPLY_TIMEOUT_MS, embed: EMBED_TIMEOUT_MS } as const;
export const AI_MAX_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS;
