import { prisma } from "../../lib/prisma.js";
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
  const exists = await prisma.user.findUnique({ where: { email: req.email }, select: { id: true } });
  if (exists) throw badRequest("Email đã tồn tại");
  const user = await prisma.user.create({
    data: {
      email: req.email,
      password: await hashPassword(req.password),
      fullName: req.fullName,
      phone: req.phone ?? null,
      address: req.address ?? null,
    },
  });
  return toAuthResponse(user);
}

export async function login(req: LoginRequest) {
  const user = await prisma.user.findUnique({ where: { email: req.email } });
  if (!user) throw unauthorized("Email không tồn tại");
  if (!(await verifyPassword(req.password, user.password))) {
    throw unauthorized("Mật khẩu không đúng");
  }
  if (!user.active) throw forbidden("Tài khoản đã bị khóa");
  return toAuthResponse(user);
}

export async function getMe(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("Bạn cần đăng nhập");
  return toUserJson(user);
}

export async function updateMe(email: string, req: UpdateProfileRequest) {
  const user = await prisma.user.update({
    where: { email },
    data: {
      fullName: req.fullName,
      phone: req.phone ?? null,
      address: req.address ?? null,
    },
  });
  return toUserJson(user);
}

/** Đổi mật khẩu phải xác minh mật khẩu cũ trước, nếu không ai có token cũng đổi được. */
export async function changePassword(email: string, req: ChangePasswordRequest) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("Bạn cần đăng nhập");
  if (!(await verifyPassword(req.currentPassword, user.password))) {
    throw badRequest("Mật khẩu hiện tại không đúng");
  }
  await prisma.user.update({
    where: { email },
    data: { password: await hashPassword(req.newPassword) },
  });
}
