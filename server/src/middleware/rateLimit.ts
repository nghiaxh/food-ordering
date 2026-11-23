import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "unknown")),
  message: { message: "Bạn gửi quá nhiều câu hỏi, vui lòng thử lại sau ít phút." },
});
