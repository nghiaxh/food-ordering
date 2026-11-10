import { rateLimit } from "express-rate-limit";

/**
 * Giới hạn lượt gọi chatbot: mỗi IP tối đa 30 câu / 5 phút. Đủ cho demo và tránh chi phí
 * AI gọi qua mạng khi bị quét tự động; status/banner không tính vào giới hạn.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Bạn gửi quá nhiều câu hỏi, vui lòng thử lại sau ít phút." },
});
