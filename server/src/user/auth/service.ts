import { eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { users } from "../../db/schema.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateToken } from "../../lib/jwt.js";
import { badRequest, forbidden, unauthorized } from "../../lib/errors.js";
import { toUserJson } from "../../lib/serializers.js";
import type { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./schema.js";
import type { z } from "zod";

type RegisterRequest = z.infer<typeof registerSchema>;
type LoginRequest = z.infer<typeof loginSchema>;
type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

const toAuthResponse = (u: { id: number; email: string; fullName: string | null; role: "CUSTOMER" | "ADMIN" }) => ({
  token: generateToken(u.email, u.role),
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
});

export async function register(req: RegisterRequest) {
  const exists = await db.query.users.findFirst({
    where: eq(users.email, req.email),
    columns: { id: true },
  });
  if (exists) throw badRequest("Email đã tồn tại");

  const [user] = await db
    .insert(users)
    .values({
      email: req.email,
      password: await hashPassword(req.password),
      fullName: req.fullName,
      phone: req.phone ?? null,
      address: req.address ?? null,
    })
    .returning();

  return toAuthResponse(user!);
}

export async function login(req: LoginRequest) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, req.email),
  });
  if (!user) throw unauthorized("Email hoặc mật khẩu không đúng");
  if (!(await verifyPassword(req.password, user.password))) {
    // Thong bao chung cho ca hai truong hop de khong lo ton tai email.
    throw unauthorized("Email hoặc mật khẩu không đúng");
  }
  if (!user.active) throw forbidden("Tài khoản đã bị khóa");
  return toAuthResponse(user);
}

export async function getMe(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) throw unauthorized("Bạn cần đăng nhập");
  return toUserJson(user);
}

export async function updateMe(email: string, req: UpdateProfileRequest) {
  // Chi set field duoc gui; phone/address omitted giu nguyen chu khong bi xoá thành null.
  const patch: Partial<typeof users.$inferInsert> = {};
  if (req.fullName !== undefined) patch.fullName = req.fullName;
  if (req.phone !== undefined) patch.phone = req.phone;
  if (req.address !== undefined) patch.address = req.address ?? null;

  const [user] = await db
    .update(users)
    .set(patch)
    .where(eq(users.email, email))
    .returning();
  if (!user) throw unauthorized("Bạn cần đăng nhập");

  return toUserJson(user);
}

/** Doi mat khau phai xac minh mat khau cu truoc, neu khong ai co token cung doi duoc. */
export async function changePassword(email: string, req: ChangePasswordRequest) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) throw unauthorized("Bạn cần đăng nhập");
  if (!(await verifyPassword(req.currentPassword, user.password))) {
    throw badRequest("Mật khẩu hiện tại không đúng");
  }
  await db
    .update(users)
    .set({ password: await hashPassword(req.newPassword) })
    .where(eq(users.email, email));
}
