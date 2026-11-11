import { Router } from "express";
import { z } from "zod";
import { parseBody } from "../../lib/validate.js";
import { optionalAuth } from "../../middleware/auth.js";
import { chatRateLimiter } from "../../middleware/rateLimit.js";
import { chat, chatbotStatus } from "./service.js";

const chatSchema = z.object({
  message: z.string().min(1, "Tin nhắn không được rỗng").max(2000, "Tin nhắn quá dài"),
  sessionId: z.string().max(100).optional(),
  history: z.array(z.string().max(500)).max(3).optional(),
  lastFoodIds: z.array(z.number().int().positive()).max(20).optional(),
});

export const chatbotRouter = Router();

// Khach vang lai van chat duoc; email chi dung de quyet dinh co luu lich su hay khong.
chatbotRouter.get("/status", optionalAuth, async (_req, res) => {
  res.json(await chatbotStatus());
});

chatbotRouter.post("/chat", chatRateLimiter, optionalAuth, async (req, res) => {
  const body = parseBody(chatSchema, req.body);
  const email = req.user?.email ?? null;
  res.json(await chat(email, body));
});
