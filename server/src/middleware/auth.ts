import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users } from "../db/schema.js";
import { verifyToken } from "../lib/jwt.js";
import { forbidden, unauthorized } from "../lib/errors.js";

interface Identity {
  id: number;
  email: string;
  role: "CUSTOMER" | "ADMIN";
}

// Tra CSDL moi request de tai khoan bi khoa mat quyen ngay ca khi token con han;
// bo qua buoc nay thi token bi khoa van dung duoc toi khi het han.
async function loadIdentity(req: Request): Promise<Identity | null> {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const identity = verifyToken(header.slice(7));
  if (!identity) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.email, identity.email),
    columns: { id: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, role: user.role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const identity = await loadIdentity(req);
  if (!identity) return next(unauthorized("Bạn cần đăng nhập"));
  req.user = identity;
  next();
}

/** Khong chan request la; chi gan req.user khi token hop le (dung cho trang review cong khai). */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await loadIdentity(req)) ?? undefined;
  next();
}

export const requireRole =
  (role: "ADMIN" | "CUSTOMER") => async (req: Request, _res: Response, next: NextFunction) => {
    const identity = await loadIdentity(req);
    if (!identity) return next(unauthorized("Bạn cần đăng nhập"));
    if (identity.role !== role) return next(forbidden("Bạn không có quyền truy cập"));
    req.user = identity;
    next();
  };
