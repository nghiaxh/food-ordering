import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { parseList, supportsThinking } from "./aiModels.js";

// Chi ho tro Gemini. Khoa bi 429 thi xoay; bi tu choi (401/403) thi loai toi khi restart.

const TIMEOUT_MS = 15_000;
const REPLY_TIMEOUT_MS = 20_000;
const EMBED_TIMEOUT_MS = 8_000;
const TOTAL_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 300;
export const EMBEDDING_DIM = 768;
const PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
const PROBE_USER = "ping";
const PROBE_TRUE_TTL_MS = 5 * 60 * 1000;
const PROBE_FALSE_TTL_MS = 60 * 1000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [600, 1800];
const RATE_LIMIT_COOLDOWN_MS = 25_000;
const MODEL_COOLDOWN_MS = 60_000;

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

interface ModelState {
  rejected: boolean;
  cooldownUntil: number;
}

const keyStates = new Map<string, KeyState>();
const modelStates = new Map<string, ModelState>();
// Model tra 400 khi co thinkingConfig thi ghi nho de lan sau khong gui nua.
const thinkingDisabledModels = new Set<string>();
let keys: string[] = [];
let nextIndex = 0;

let keyAccepted: boolean | null = null;
let keyCheckedAt = 0;

let cachedChatModels: string[] | null = null;
let cachedEmbedModels: string[] | null = null;

const parseKeysFromEnv = (): string[] => parseList(env.AI_API_KEYS);

const initKeys = (): void => {
  keys = parseKeysFromEnv();
  keyStates.clear();
  for (const k of keys) keyStates.set(k, { rejected: false, rateLimitedUntil: 0 });
  nextIndex = 0;
};

initKeys();

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

const stateOfModel = (model: string): ModelState => modelStates.get(model) ?? { rejected: false, cooldownUntil: 0 };

const modelAvailable = (model: string): boolean => {
  const s = stateOfModel(model);
  return !s.rejected && s.cooldownUntil <= Date.now();
};

const markModelRejected = (model: string): void => {
  modelStates.set(model, { rejected: true, cooldownUntil: 0 });
};

const markModelCooldown = (model: string): void => {
  const s = stateOfModel(model);
  modelStates.set(model, { ...s, cooldownUntil: Date.now() + MODEL_COOLDOWN_MS });
};

const clearModelCooldown = (model: string): void => {
  const s = stateOfModel(model);
  if (s.rejected) return;
  modelStates.set(model, { rejected: false, cooldownUntil: 0 });
};

export const isConfigured = (): boolean => keys.some((k) => !stateOf(k).rejected);

export const hasKeys = (): boolean => keys.length > 0;

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

// Loi thuoc ve model (khong phai khoa): nen thu model khac thay vi dung han.
const isModelLevelError = (error: unknown): boolean => {
  if (error instanceof AiKeyRejectedException || error instanceof AiRateLimitedException) return false;
  const status = statusOf(error);
  return status === 0 || status === 400 || status === 404 || RETRYABLE_STATUS.has(status);
};

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

const getChatModels = async (): Promise<string[]> => {
  if (cachedChatModels) return cachedChatModels;
  const fromEnv = parseList((process.env.AI_MODELS ?? "").trim() || (env.AI_MODELS ?? "").trim());
  if (fromEnv.length > 0) {
    cachedChatModels = fromEnv;
    return fromEnv;
  }
  const key = availableKeys()[0] ?? keys[0];
  if (!key) throw new Error("Thieu khoa API cua dich vu AI");
  const detected = await detectChatModel(key);
  cachedChatModels = [detected];
  return cachedChatModels;
};

const getEmbedModels = async (): Promise<string[]> => {
  if (cachedEmbedModels) return cachedEmbedModels;
  const fromEnv = parseList((process.env.EMBEDDING_MODELS ?? "").trim() || (env.EMBEDDING_MODELS ?? "").trim());
  if (fromEnv.length > 0) {
    cachedEmbedModels = fromEnv;
    return fromEnv;
  }
  const key = availableKeys()[0] ?? keys[0];
  if (!key) throw new Error("Thieu khoa API cua dich vu AI");
  const detected = await detectEmbedModel(key);
  cachedEmbedModels = [detected];
  return cachedEmbedModels;
};

const generateWithKey = async (
  key: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  options: { timeoutMs?: number; maxOutputTokens?: number; deadline?: number },
): Promise<string> => {
  const baseTimeoutMs = options.timeoutMs ?? (jsonMode ? 10_000 : TIMEOUT_MS);
  let useThinking = supportsThinking(model) && !thinkingDisabledModels.has(model);
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_RETRIES) {
    // Deadline tong chan truong hop 3 model x 3 lan retry cong don thanh phut.
    const remaining = options.deadline ? options.deadline - Date.now() : baseTimeoutMs;
    if (remaining <= 0) break;
    const timeoutMs = Math.min(baseTimeoutMs, remaining);
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
            ...(useThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        timeoutMs,
      );
      clearCooldown(key);
      clearModelCooldown(model);
      return stripThinking(response.text ?? "");
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
      // Model khong nhan thinkingConfig: bo co va thu lai, khong tinh vao so lan retry.
      if (status === 400 && useThinking) {
        thinkingDisabledModels.add(model);
        useThinking = false;
        console.warn(`[ai] model ${model} khong nhan thinkingConfig, thu lai khong thinking`);
        continue;
      }
      if (!RETRYABLE_STATUS.has(status) || attempt === MAX_RETRIES) break;
      const wait = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      console.warn(`[ai] model ${model} loi ${status}, thu lai sau ${wait}ms`);
      attempt += 1;
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
  const models = await getChatModels();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError: unknown;

  for (const model of models) {
    if (!modelAvailable(model)) continue;
    const tried = new Set<string>();
    let modelError: unknown;
    while (tried.size < keys.length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const key = pickKey(tried);
      if (!key) break;
      tried.add(key);
      try {
        return await generateWithKey(key, model, systemPrompt, userPrompt, jsonMode, {
          ...options,
          timeoutMs: Math.min(options.timeoutMs ?? (jsonMode ? 10_000 : TIMEOUT_MS), remaining),
          deadline,
        });
      } catch (error) {
        lastError = error;
        if (error instanceof AiKeyRejectedException || error instanceof AiRateLimitedException) continue;
        modelError = error;
        break; // loi model: sang model ke tiep
      }
    }
    if (modelError && isModelLevelError(modelError)) {
      if (statusOf(modelError) === 404) markModelRejected(model);
      else markModelCooldown(model);
      console.warn(`[ai] model ${model} khong dung duoc, chuyen model khac`);
    }
    if (availableKeys().length === 0 && keys.some((k) => !stateOf(k).rejected)) break;
    if (Date.now() >= deadline) break;
  }

  if (keys.length > 0 && availableKeys().length === 0 && keys.some((k) => !stateOf(k).rejected)) {
    throw new AiRateLimitedException("Tat ca khoa AI dang gioi han, vui long thu lai sau");
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Loi dich vu AI"));
};

export const verifyKey = async (): Promise<boolean> => {
  if (keys.length === 0) return false;
  const ttl = keyAccepted === true ? PROBE_TRUE_TTL_MS : PROBE_FALSE_TTL_MS;
  if (keyAccepted !== null && Date.now() - keyCheckedAt < ttl) return keyAccepted;

  let models: string[];
  try {
    models = await getChatModels();
  } catch {
    keyAccepted = false;
    keyCheckedAt = Date.now();
    return false;
  }

  // Probe song song de /status tra loi som khi co mot model chay duoc, va khong treo
  // qua lau khi tat ca deu loi. Model cham (timeout) khong bi coi la hong.
  const probeDeadline = Date.now() + 25_000;
  const probeModel = async (model: string): Promise<"ok" | "down" | "slow"> => {
    for (const key of keys) {
      if (stateOf(key).rejected) continue;
      try {
        await generateWithKey(key, model, PROBE_SYSTEM, PROBE_USER, false, {
          timeoutMs: 20_000,
          maxOutputTokens: 16,
          deadline: probeDeadline,
        });
        return "ok";
      } catch (error) {
        if (error instanceof AiKeyRejectedException) {
          markRejected(key);
          continue;
        }
        if (error instanceof AiRateLimitedException) {
          markRateLimited(key);
          continue;
        }
        // Model cham (timeout) van dung duoc cho request that; chi nghi khi loi ro rang.
        const status = statusOf(error);
        if (status === 404) markModelRejected(model);
        else if (status !== 0) markModelCooldown(model);
        console.warn(`[ai] probe model ${model} that bai: ${messageOf(error)}`);
        return status === 0 ? "slow" : "down";
      }
    }
    return "down";
  };

  const probes = models.filter((m) => modelAvailable(m)).map((m) => probeModel(m));
  const results = await new Promise<Array<"ok" | "down" | "slow">>((resolve) => {
    if (probes.length === 0) {
      resolve([]);
      return;
    }
    const done: Array<"ok" | "down" | "slow"> = [];
    let pending = probes.length;
    for (const p of probes) {
      p.then((result) => {
        done.push(result);
        pending -= 1;
        if (result === "ok" || pending === 0) resolve(done);
      });
    }
  });

  // Chi bao hong khi moi model deu loi ro rang. Mot model chet (404/503) khong duoc keo
  // ca he thong xuong, vi model ke tiep van co the tra loi.
  const ok = results.some((r) => r !== "down");
  keyAccepted = ok;
  keyCheckedAt = Date.now();
  return ok;
};

export const embed = async (text: string): Promise<number[] | null> => {
  const results = await embedBatch([text]);
  return results[0] ?? null;
};

export const embedBatch = async (texts: string[]): Promise<Array<number[] | null>> => {
  if (texts.length === 0) return [];
  if (!isConfigured()) return texts.map(() => null);

  const models = await getEmbedModels();
  const results: Array<number[] | null> = new Array(texts.length).fill(null);
  const batchSize = 16;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let success = false;
    for (const model of models) {
      if (!modelAvailable(model)) continue;
      const tried = new Set<string>();
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
          clearModelCooldown(model);
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
          if (status === 404) markModelRejected(model);
          else markModelCooldown(model);
          console.warn(`[ai] embed model ${model} loi ${status}, chuyen model khac`);
          break;
        }
      }
      if (success) break;
    }
    if (!success) {
      console.warn(`[ai] embed batch ${i} that bai sau khi thu cac model/khoa`);
    }
  }
  return results;
};

export const AI_TIMEOUTS = { reply: REPLY_TIMEOUT_MS, embed: EMBED_TIMEOUT_MS } as const;
export const AI_MAX_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS;
