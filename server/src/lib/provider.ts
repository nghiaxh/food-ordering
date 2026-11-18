import { eq } from "drizzle-orm";
import { aiSetting } from "../db/schema.js";
import { db } from "./db.js";
import { env } from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { LMStudioClient } from "@lmstudio/sdk";

// Lop duy nhat goi API AI. Ho tro Gemini (cloud) va LM Studio (local).
// Provider doc tu env AI_PROVIDER (hoac tu dong detect), model/embedding doc tu env
// (hoac tu dong detect tu provider). Khong log khoa, khong tra khoa ve client.
export const PROVIDER_GEMINI = "gemini";
export const PROVIDER_LMSTUDIO = "lmstudio";
export const SUPPORTED_PROVIDERS = [PROVIDER_GEMINI, PROVIDER_LMSTUDIO] as const;

const TIMEOUT_MS = 15_000;
const EXTRACT_TIMEOUT_MS = 10_000;
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
const RETRY_AFTER_CAP_MS = 5_000;
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

let credentialsRejected = false;
let keyAccepted: boolean | null = null;
let probeFailedAt = 0;
let rateLimitedUntil = 0;

// Cache model da detect de khong goi list moi lan.
let cachedProvider: string | null = null;
let cachedChatModel: string | null = null;
let cachedEmbedModel: string | null = null;

export const isRateLimited = (): boolean => Date.now() < rateLimitedUntil;

export const isConfigured = (): boolean => {
  const provider = detectProviderSync();
  if (provider === PROVIDER_GEMINI) {
    const apiKey = env.AI_API_KEY;
    return !!apiKey && apiKey.trim().length > 0 && !credentialsRejected;
  }
  // LM Studio: coi nhu cau hinh duoc (khong can key), kiem tra luc goi.
  return true;
};

export const _resetKeyStateForTests = () => {
  credentialsRejected = false;
  keyAccepted = null;
  probeFailedAt = 0;
  rateLimitedUntil = 0;
  cachedProvider = null;
  cachedChatModel = null;
  cachedEmbedModel = null;
};

const setting = async (key: string, fallback: string): Promise<string> => {
  const row = await db.query.aiSetting.findFirst({ where: eq(aiSetting.settingKey, key) });
  const value = row?.settingValue?.trim();
  return value ? value : fallback;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Gemma 4 tra ve thinking tokens (<|channel>thought...<channel|>) truoc answer.
// Strip de lay ket qua sach cho JSON parsing.
const stripThinking = (text: string): string => {
  return text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "").trim();
};

/** Detect provider: env AI_PROVIDER > auto-detect (key present => gemini, else lmstudio). */
const detectProviderSync = (): string => {
  const fromEnv = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (fromEnv === PROVIDER_GEMINI || fromEnv === PROVIDER_LMSTUDIO) return fromEnv;
  const apiKey = (env.AI_API_KEY ?? "").trim();
  if (apiKey.length > 0) return PROVIDER_GEMINI;
  return PROVIDER_LMSTUDIO;
};

const getProvider = async (): Promise<string> => {
  if (cachedProvider) return cachedProvider;
  const fromSetting = await setting("provider", "");
  const p = fromSetting.trim().toLowerCase();
  if (p === PROVIDER_GEMINI || p === PROVIDER_LMSTUDIO) {
    cachedProvider = p;
    return p;
  }
  const detected = detectProviderSync();
  cachedProvider = detected;
  return detected;
};

/** Auto-detect chat model tu provider. */
const detectChatModel = async (provider: string): Promise<string> => {
  if (provider === PROVIDER_GEMINI) {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) throw new Error("Thieu AI_API_KEY");
    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list();
    const models = (pager as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models ?? [];
    const chatModel = models.find((m) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    );
    if (!chatModel?.name) throw new Error("Khong tim thay model chat Gemini");
    return chatModel.name.replace(/^models\//, "");
  }
  // LM Studio
  const baseUrl = env.LMSTUDIO_BASE_URL || "ws://localhost:1234";
  const client = new LMStudioClient({ baseUrl });
  const downloaded = await client.system.listDownloadedModels();
  const llm = (downloaded as Array<{ type?: string; modelKey?: string }>).find((m) => m.type === "llm");
  if (!llm?.modelKey) throw new Error("Khong tim thay model chat LM Studio (can load model)");
  return llm.modelKey;
};

/** Auto-detect embedding model tu provider. */
const detectEmbedModel = async (provider: string): Promise<string> => {
  if (provider === PROVIDER_GEMINI) {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) throw new Error("Thieu AI_API_KEY");
    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list();
    const models = (pager as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models ?? [];
    const embModel = models.find((m) =>
      (m.supportedGenerationMethods ?? []).includes("embedContent"),
    );
    if (!embModel?.name) throw new Error("Khong tim thay model embedding Gemini");
    return embModel.name.replace(/^models\//, "");
  }
  // LM Studio
  const baseUrl = env.LMSTUDIO_BASE_URL || "ws://localhost:1234";
  const client = new LMStudioClient({ baseUrl });
  const downloaded = await client.system.listDownloadedModels();
  const emb = (downloaded as Array<{ type?: string; modelKey?: string }>).find((m) => m.type === "embedding");
  if (!emb?.modelKey) throw new Error("Khong tim thay model embedding LM Studio");
  return emb.modelKey;
};

const getChatModel = async (): Promise<string> => {
  if (cachedChatModel) return cachedChatModel;
  const fromEnv = (env.AI_MODEL ?? "").trim();
  if (fromEnv) {
    cachedChatModel = fromEnv;
    return fromEnv;
  }
  const fromSetting = await setting("model", "");
  if (fromSetting) {
    cachedChatModel = fromSetting;
    return fromSetting;
  }
  const provider = await getProvider();
  const detected = await detectChatModel(provider);
  cachedChatModel = detected;
  return detected;
};

const getEmbedModel = async (): Promise<string> => {
  if (cachedEmbedModel) return cachedEmbedModel;
  const fromEnv = (env.EMBEDDING_MODEL ?? "").trim();
  if (fromEnv) {
    cachedEmbedModel = fromEnv;
    return fromEnv;
  }
  const fromSetting = await setting("embedding_model", "");
  if (fromSetting) {
    cachedEmbedModel = fromSetting;
    return fromSetting;
  }
  const provider = await getProvider();
  const detected = await detectEmbedModel(provider);
  cachedEmbedModel = detected;
  return detected;
};

const fetchWithTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });

export const verifyKey = async (): Promise<boolean> => {
  const provider = await getProvider();
  if (provider !== PROVIDER_GEMINI) return true; // LM Studio: coi nhu OK
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
    probeFailedAt = Date.now();
    return true;
  }
};

export interface GenerateOptions {
  timeoutMs?: number;
  maxOutputTokens?: number;
}

const isKeyRejectionStatus = (status: number, body: string): boolean => {
  if (status === 401 || status === 403) return true;
  return body.includes("API_KEY_INVALID") || body.includes("API key not valid");
};

// --- generate ---

export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: GenerateOptions = {},
): Promise<string> => {
  const provider = await getProvider();
  const timeoutMs = options.timeoutMs ?? (jsonMode ? EXTRACT_TIMEOUT_MS : TIMEOUT_MS);

  if (provider === PROVIDER_GEMINI) {
    const apiKey = env.AI_API_KEY;
    if (!apiKey || !apiKey.trim()) throw new Error("Chưa cấu hình khóa API của dịch vụ AI");
    if (Date.now() < rateLimitedUntil) throw new AiRateLimitedException("Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau");

    const model = await getChatModel();
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey });
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
        rateLimitedUntil = 0;
        return stripThinking(text);
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number })?.status ?? 0;
        const body = error instanceof Error ? error.message : String(error);
        if (status === 429) {
          rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          console.warn("[ai] provider tra 429, tam dung goi AI 25s");
        }
        if (isKeyRejectionStatus(status, body)) {
          credentialsRejected = true;
          keyAccepted = false;
          throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", { cause: error });
        }
        if (!RETRYABLE_STATUS.has(status) || attempt === MAX_RETRIES) break;
        const wait = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
        console.warn(`[ai] provider loi ${status}, thu lai sau ${wait}ms`);
        await sleep(wait);
      }
    }
    const status = (lastError as { status?: number })?.status ?? 0;
    if (status === 429) throw new AiRateLimitedException("Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau", { cause: lastError });
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  // LM Studio
  if (Date.now() < rateLimitedUntil) throw new AiRateLimitedException("Dịch vụ AI đang giới hạn số yêu cầu, vui lòng thử lại sau");
  const baseUrl = env.LMSTUDIO_BASE_URL || "ws://localhost:1234";
  const modelKey = await getChatModel();
  const client = new LMStudioClient({ baseUrl });
  const model = await client.llm.model(modelKey);
  const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  try {
    const prediction = model.complete(prompt, { maxTokens: options.maxOutputTokens ?? MAX_OUTPUT_TOKENS });
    const result = await fetchWithTimeout(prediction, timeoutMs);
    rateLimitedUntil = 0;
    return stripThinking((result as { content?: string }).content ?? "");
  } catch (error) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    throw error instanceof Error ? error : new Error(String(error));
  }
};

// --- embed ---

export const embed = async (text: string): Promise<number[] | null> => {
  const results = await embedBatch([text]);
  return results[0] ?? null;
};

export const embedBatch = async (texts: string[]): Promise<Array<number[] | null>> => {
  if (!isConfigured()) return texts.map(() => null);
  if (texts.length === 0) return [];

  const provider = await getProvider();
  const results: Array<number[] | null> = new Array(texts.length).fill(null);

  if (provider === PROVIDER_GEMINI) {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) return texts.map(() => null);
    const model = await getEmbedModel();
    const ai = new GoogleGenAI({ apiKey });
    const batchSize = 16;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
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
        rateLimitedUntil = 0;
      } catch (error) {
        const status = (error as { status?: number })?.status ?? 0;
        const body = error instanceof Error ? error.message : String(error);
        if (isKeyRejectionStatus(status, body)) {
          credentialsRejected = true;
          keyAccepted = false;
        }
        console.warn(`[ai] embed exception: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return results;
  }

  // LM Studio
  const baseUrl = env.LMSTUDIO_BASE_URL || "ws://localhost:1234";
  const modelKey = await getEmbedModel();
  const client = new LMStudioClient({ baseUrl });
  try {
    const model = await client.embedding.model(modelKey);
    for (let i = 0; i < texts.length; i++) {
      try {
        const emb = await model.embed(texts[i]!);
        const vals = (emb as { embedding?: number[] })?.embedding;
        if (vals && vals.length === EMBEDDING_DIM) results[i] = vals;
      } catch (error) {
        console.warn(`[ai] embed exception: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.warn(`[ai] lmstudio embedding model load failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return results;
};

export const AI_TIMEOUTS = { extract: EXTRACT_TIMEOUT_MS, reply: REPLY_TIMEOUT_MS, embed: EMBED_TIMEOUT_MS } as const;
export const AI_MAX_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS;