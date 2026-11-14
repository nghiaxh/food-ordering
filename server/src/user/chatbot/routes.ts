import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { chatRateLimiter } from "../../middleware/rateLimit.js";
import { chat, chatbotStatus, deleteSession, getSession, listSessions } from "./service.js";

const chatSchema = z.object({
  message: z.string().min(1, "Tin nhắn không được rỗng").max(2000, "Tin nhắn quá dài"),
  sessionId: z.string().max(100).optional(),
  history: z.array(z.string().max(500)).max(3).optional(),
  lastFoodIds: z.array(z.number().int().positive()).max(20).optional(),
});

const sessionIdParam = (raw: string | string[] | undefined): string => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.length > 100) throw badRequest("Mã hội thoại không hợp lệ");
  return value;
};

export const chatbotRouter = Router();

// Khach vang lai van chat duoc; email chi dung de quyet dinh co luu lich su hay khong.
chatbotRouter.get("/status", optionalAuth, async (_req, res) => {
  res.json(await chatbotStatus());
});

// Lich su chi cua nguoi dang dang nhap; khong dung chung session cua khach vang lai.
chatbotRouter.get("/sessions", requireAuth, async (req, res) => {
  res.json(await listSessions(req.user!.email));
});

chatbotRouter.get("/sessions/:sessionId", requireAuth, async (req, res) => {
  res.json(await getSession(req.user!.email, sessionIdParam(req.params.sessionId)));
});

chatbotRouter.delete("/sessions/:sessionId", requireAuth, async (req, res) => {
  res.json(await deleteSession(req.user!.email, sessionIdParam(req.params.sessionId)));
});

chatbotRouter.post("/chat", chatRateLimiter, optionalAuth, async (req, res) => {
  const body = parseBody(chatSchema, req.body);
  const email = req.user?.email ?? null;
  res.json(await chat(email, body));
});
