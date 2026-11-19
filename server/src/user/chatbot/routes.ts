import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { chatRateLimiter } from "../../middleware/rateLimit.js";
import { chat, chatbotStatus, deleteSession, getSession, listSessions, getLatestSession } from "./service.js";

const chatSchema = z.object({
  message: z.string().min(1, "Tin nhắn không được rỗng").max(2000, "Tin nhắn quá dài"),
  sessionId: z.string().max(100).optional(),
});

const sessionIdParam = (raw: string | string[] | undefined): string => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.length > 100) throw badRequest("Mã hội thoại không hợp lệ");
  return value;
};

export const chatbotRouter = Router();

// Trang thai tro ly: cong khai de client khoa o nhap khi chua cau hinh khoa.
chatbotRouter.get("/status", async (_req, res) => {
  res.json(await chatbotStatus());
});

// Lich su chi cua nguoi dang dang nhap.
chatbotRouter.get("/sessions", requireAuth, async (req, res) => {
  res.json(await listSessions(req.user!.email));
});

chatbotRouter.get("/sessions/latest", requireAuth, async (req, res) => {
  res.json(await getLatestSession(req.user!.email));
});

chatbotRouter.get("/sessions/:sessionId", requireAuth, async (req, res) => {
  res.json(await getSession(req.user!.email, sessionIdParam(req.params.sessionId)));
});

chatbotRouter.delete("/sessions/:sessionId", requireAuth, async (req, res) => {
  res.json(await deleteSession(req.user!.email, sessionIdParam(req.params.sessionId)));
});

// Chi khach da dang nhap moi chat duoc.
chatbotRouter.post("/chat", requireAuth, chatRateLimiter, async (req, res) => {
  const body = parseBody(chatSchema, req.body);
  res.json(await chat(req.user!.email, body));
});