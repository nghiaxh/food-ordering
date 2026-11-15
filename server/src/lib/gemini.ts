import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { aiSetting } from "../db/schema.js";
import { db } from "./db.js";
import { env } from "../config/env.js";

// Lop duy nhat goi API AI. Doi nha cung cap chi can sua file nay.
// Provider/model doc tu bang cau hinh `ai_setting`, chi fallback ve bien moi truong khi chua dat.
// Khong log khoa va khong tra khoa ve client.
export const PROVIDER_GEMINI = "gemini";
export const SUPPORTED_PROVIDERS = [PROVIDER_GEMINI] as const;

const TIMEOUT_MS = 15_000;
const PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
const PROBE_USER = "ping";
const PROBE_RETRY_MS = 5 * 60 * 1000;

/** Khoa API bi nha cung cap tu choi (sai, het han, chua bat API) - khong phai loi tam thoi. */
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

/** Reset bo nho cache - chi dung trong test hoac khi khoi dong lai tien trinh. */
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

/** Goi dich vu AI; loi tam thoi thi nem RuntimeException de chatbot tu roi sang nhanh du phong. */
export const generate = async (
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
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

  try {
    return await callGemini(apiKey, model, systemPrompt, userPrompt, jsonMode);
  } catch (error) {
    if (isKeyRejected(error)) {
      credentialsRejected = true;
      keyAccepted = false;
      throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", { cause: error });
    }
    throw new Error(`Không gọi được dịch vụ AI: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

const isKeyRejected = (error: unknown): boolean => {
  if (error instanceof AiKeyRejectedException) return true;
  const body = error instanceof Error ? error.message : String(error);
  const status = typeof error === "object" && error !== null
    ? Number((error as { status?: unknown; code?: unknown }).status ?? (error as { status?: unknown; code?: unknown }).code)
    : NaN;
  return Number.isFinite(status) && isKeyRejectionBody(status, body);
};

const callGemini = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<string> => {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: TIMEOUT_MS },
  });
  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: jsonMode ? 0.2 : 0.4,
      responseMimeType: jsonMode ? "application/json" : undefined,
    },
  });
  return response.text ?? "";
};
