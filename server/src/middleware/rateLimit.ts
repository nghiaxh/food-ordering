import { rateLimit } from "express-rate-limit";

/**
 * Gioi han luot goi chatbot: moi IP toi da 50 cau / 5 phut. Du cho demo va tranh chi phi
 * AI goi qua mang khi bi quet tu dong; status/banner khong tinh vao gioi han.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : req.ip ?? "unknown"),
  message: { message: "Bạn gửi quá nhiều câu hỏi, vui lòng thử lại sau ít phút." },
});
