import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Subject la email (cac service tra user theo email), role dat trong claim de requireRole doc.
// Ky HS256 bang dung secret cau hinh; token hop le moi doc duoc identity.
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
    // Token sai/het han duoc coi nhu chua dang nhap; request van di tiep va bi middleware chan.
    return null;
  }
}
