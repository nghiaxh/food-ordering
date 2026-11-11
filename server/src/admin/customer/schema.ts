import { z } from "zod";

export const adminUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  // Mat khau de trong khi sua = giu mat khau hien tai.
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").optional().or(z.literal("")),
  fullName: z.string().min(1, "Họ tên không được để trống"),
  phone: z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số").optional().or(z.literal("")),
  address: z.string().optional(),
});