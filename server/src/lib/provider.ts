import { GoogleGenAI } from "@google/genai";

// Lop duy nhat goi API AI. Chi ho tro Gemini (cloud). Khong log khoa, khong tra khoa ve client.
// Ho tro nhieu khoa Gemini qua env AI_API_KEYS (phan tach dau phay/xuong dong) hoac AI_API_KEY (don).
// Khi mot khoa bi 429, tu dong xoay sang khoa khac va retry; khoa bi tu choi (401/403/API_KEY_INVALID)
// bi loai vinh vien toi khi khoi dong lai server.

const TIMEOUT_MS = 15_000;
const REPLY_TIMEOUT_MS = 12_000;
const EMBED_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 500;
export const EMBEDDING_DIM = 768;
const PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
const PROBE_USER = "ping";
const PROBE_RETRY_MS = 5 * 60 * 1000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [600, 1800];
const RATE_LIMIT_COOLDOWN_MS = 25_000;

export class AiKeyRejectedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiKeyRejectedException";
  }
}

export class AiRateLimitedException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRateLimitedException";
  }
}

interface KeyState {
  rejected: boolean;
  rateLimitedUntil: number;
}

const keyStates = new Map<string, KeyState>();
let keys: string[] = [];
let nextIndex = 0;

let keyAccepted: boolean | null = null;
let probeFailedAt = 0;

let cachedChatModel: string | null = null;
let cachedEmbedModel: string | null = null;

import { env } from "../config/env.js";

const parseKeysFromEnv = (): string[] => {
  const fromList = (env.AI_API_KEYS ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const list = fromList.length > 0 ? fromList : (env.AI_API_KEY ?? "").trim() ? [(env.AI_API_KEY ?? "").trim()] : [];
  return [...new Set(list)];
};

const initKeys = (): void => {
  keys = parseKeysFromEnv();
  keyStates.clear();
  for (const k of keys) keyStates.set(k, { rejected: false, rateLimitedUntil: 0 });
  nextIndex = 0;
};

initKeys();

export const _resetKeyStateForTests = (): void => {
  initKeys();
  keyAccepted = null;
  probeFailedAt = 0;
  cachedChatModel = null;
  cachedEmbedModel = null;
};

const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Gemma 4 tra ve thinking tokens (<|channel>thought...<channel|>) truoc answer.
// Strip de lay ket qua sach cho JSON parsing.
const stripThinking = (text: string): string => {
  return text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "").trim();
};

const stateOf = (key: string): KeyState => keyStates.get(key) ?? { rejected: false, rateLimitedUntil: 0 };

const availableKeys = (): string[] => {
  const now = Date.now();
  return keys.filter((k) => !stateOf(k).rejected && stateOf(k).rateLimitedUntil <= now);
};

const pickKey = (exclude?: Set<string>): string | null => {
  const pool = availableKeys().filter((k) => !exclude?.has(k));
  if (pool.length === 0) return null;
  for (let i = 0; i < keys.length; i++) {
    const idx = (nextIndex + i) % keys.length;
    const k = keys[idx]!;
    if (pool.includes(k)) {
      nextIndex = (idx + 1) % keys.length;
      return k;
    }
  }
  return pool[0] ?? null;
};

const markRateLimited = (key: string): void => {
  const s = stateOf(key);
  s.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  keyStates.set(key, s);
};

const markRejected = (key: string): void => {
  const s = stateOf(key);
  s.rejected = true;
  keyStates.set(key, s);
};

const clearCooldown = (key: string): void => {
  const s = stateOf(key);
  s.rateLimitedUntil = 0;
  keyStates.set(key, s);
};

export const isConfigured = (): boolean => {
  return keys.some((k) => !stateOf(k).rejected);
};

const fetchWithTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });

const isKeyRejectionStatus = (status: number, body: string): boolean => {
  if (status === 401 || status === 403) return true;
  return body.includes("API_KEY_INVALID") || body.includes("API key not valid");
};

const statusOf = (error: unknown): number => (error as { status?: number })?.status ?? 0;
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const detectChatModel = async (key: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: key });
  const pager = await ai.models.list();
  const models = (pager as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models ?? [];
  const chatModel = models.find((m) =>
    (m.supportedGenerationMethods ?? []).includes("generateContent"),
  );
  if (!chatModel?.name) throw new Error("Khong tim thay model chat Gemini");
  return chatModel.name.replace(/^models\//, "");
};

const detectEmbedModel = async (key: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: key });
  const pager = await ai.models.list();
  const models = (pager as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models ?? [];
  const embModel = models.find((m) =>
    (m.supportedGenerationMethods ?? []).includes("embedContent"),
  );
  if (!embModel?.name) throw new Error("Khong tim thay model embedding Gemini");
  return embModel.name.replace(/^models\//, "");
};

const getChatModel = async (): Promise<string> => {
  if (cachedChatModel) return cachedChatModel;
  const fromEnv = (process.env.AI_MODEL ?? "").trim() || (env.AI_MODEL ?? "").trim();
  if (fromEnv) {
    cachedChatModel = fromEnv;
    return fromEnv;
  }
  const key = availableKeys()[0] ?? keys[0];
  if (!key) throw new Error("Thieu khoa API cua dich vu AI");
  const detected = await detectChatModel(key);
  cachedChatModel = detected;
  return detected;
};

const getEmbedModel = async (): Promise<string> => {
  if (cachedEmbedModel) return cachedEmbedModel;
  const fromEnv = (process.env.EMBEDDING_MODEL ?? "").trim() || (env.EMBEDDING_MODEL ?? "").trim();
  if (fromEnv) {
    cachedEmbedModel = fromEnv;
    return fromEnv;
  }
  const key = availableKeys()[0] ?? keys[0];
  if (!key) throw new Error("Thieu khoa API cua dich vu AI");
  const detected = await detectEmbedModel(key);
  cachedEmbedModel = detected;
  return detected;
};

const generateWithKey = async (
  key: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: { timeoutMs?: number; maxOutputTokens?: number },
): Promise<string> => {
  const timeoutMs = options.timeoutMs ?? (jsonMode ? 10_000 : TIMEOUT_MS);
  const model = await getChatModel();
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await fetchWithTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: jsonMode ? 0.2 : 0.4,
            responseMimeType: jsonMode ? "application/json" : undefined,
            maxOutputTokens: options.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
          },
        }),
        timeoutMs,
      );
      const text = response.text ?? "";
      clearCooldown(key);
      return stripThinking(text);
    } catch (error) {
      lastError = error;
      const status = statusOf(error);
      const body = messageOf(error);
      if (isKeyRejectionStatus(status, body)) {
        markRejected(key);
        throw new AiKeyRejectedException("Khoa API cua dich vu AI bi tu choi", { cause: error });
      }
      if (status === 429) {
        markRateLimited(key);
        throw new AiRateLimitedException("Dich vu AI dang gioi han so yeu cau, vui long thu lai sau", { cause: error });
      }
      if (!RETRYABLE_STATUS.has(status) || attempt === MAX_RETRIES) break;
      const wait = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      console.warn(`[ai] provider loi ${status}, thu lai sau ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: { timeoutMs?: number; maxOutputTokens?: number } = {},
): Promise<string> => {
  if (keys.length === 0) throw new Error("Chua cau hinh khoa API cua dich vu AI");
  const tried = new Set<string>();
  let lastError: unknown;
  while (tried.size < keys.length) {
    const key = pickKey(tried);
    if (!key) break;
    tried.add(key);
    try {
      return await generateWithKey(key, systemPrompt, userPrompt, jsonMode, options);
    } catch (error) {
      lastError = error;
      if (error instanceof AiKeyRejectedException || error instanceof AiRateLimitedException) continue;
      break;
    }
  }
  if (keys.length > 0 && availableKeys().length === 0 && keys.some((k) => !stateOf(k).rejected)) {
    throw new AiRateLimitedException("Tat ca khoa AI dang gioi han, vui long thu lai sau");
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Loi dich vu AI"));
};

export const verifyKey = async (): Promise<boolean> => {
  if (keys.length === 0) return false;
  if (keyAccepted !== null) return keyAccepted;
  if (Date.now() - probeFailedAt < PROBE_RETRY_MS) return true;
  for (const key of keys) {
    if (stateOf(key).rejected) continue;
    try {
      await generateWithKey(key, PROBE_SYSTEM, PROBE_USER, false, { timeoutMs: 8_000, maxOutputTokens: 16 });
      keyAccepted = true;
      return true;
    } catch (error) {
      if (error instanceof AiKeyRejectedException) {
        markRejected(key);
        continue;
      }
      probeFailedAt = Date.now();
      return true;
    }
  }
  if (keys.every((k) => stateOf(k).rejected)) {
    keyAccepted = false;
    return false;
  }
  return true;
};

export const embed = async (text: string): Promise<number[] | null> => {
  const results = await embedBatch([text]);
  return results[0] ?? null;
};

export const embedBatch = async (texts: string[]): Promise<Array<number[] | null>> => {
  if (texts.length === 0) return [];
  if (!isConfigured()) return texts.map(() => null);

  const model = await getEmbedModel();
  const results: Array<number[] | null> = new Array(texts.length).fill(null);
  const batchSize = 16;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const tried = new Set<string>();
    let success = false;
    while (tried.size < keys.length && !success) {
      const key = pickKey(tried);
      if (!key) break;
      tried.add(key);
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await fetchWithTimeout(
          ai.models.embedContent({
            model,
            contents: batch,
            config: { outputDimensionality: EMBEDDING_DIM },
          }),
          EMBED_TIMEOUT_MS,
        );
        const embeddings = response.embeddings ?? [];
        for (let j = 0; j < batch.length; j++) {
          const vals = embeddings[j]?.values;
          if (vals && vals.length === EMBEDDING_DIM) results[i + j] = vals;
        }
        clearCooldown(key);
        success = true;
      } catch (error) {
        const status = statusOf(error);
        const body = messageOf(error);
        if (isKeyRejectionStatus(status, body)) {
          markRejected(key);
          continue;
        }
        if (status === 429) {
          markRateLimited(key);
          continue;
        }
        console.warn(`[ai] embed exception: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    if (!success) {
      console.warn(`[ai] embed batch ${i} that bai sau khi thu cac khoa`);
    }
  }
  return results;
};

export const AI_TIMEOUTS = { reply: REPLY_TIMEOUT_MS, embed: EMBED_TIMEOUT_MS } as const;
export const AI_MAX_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS;