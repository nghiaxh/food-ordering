import { z } from "zod";

// SĐT Việt Nam: 10 chữ số, bắt đầu bằng 0. Ràng buộc biên giữ nguyên như bản Java.
export const PHONE_PATTERN = /^0\d{9}$/;

export const registerSchema = z.object({
  email: z.email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
  fullName: z.string().min(1, "Họ tên không được để trống"),
  phone: z.string().regex(PHONE_PATTERN, "Số điện thoại phải gồm đúng 10 chữ số").optional(),
  address: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email không được để trống"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Họ tên không được để trống"),
  phone: z.string().regex(PHONE_PATTERN, "Số điện thoại phải gồm đúng 10 chữ số").optional(),
  address: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại không được để trống"),
  newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự"),
});
