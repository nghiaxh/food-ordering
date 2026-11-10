import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Subject là email (các service tra user theo email), role đặt trong claim để requireRole đọc.
// Ký HS256 bằng đúng secret cấu hình; token hợp lệ mới đọc được identity.
export function generateToken(email: string, role: string): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: email,
    expiresIn: Math.floor(env.JWT_EXPIRATION_MS / 1000),
  });
}

export function verifyToken(token: string): { email: string; role: string } | null {
  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof claims.sub !== "string" || typeof claims.role !== "string") return null;
    return { email: claims.sub, role: claims.role };
  } catch {
    // Token sai/hết hạn được coi như chưa đăng nhập; request vẫn đi tiếp và bị middleware chặn.
    return null;
  }
}
