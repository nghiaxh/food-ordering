import { z } from "zod";

export const addressRequestSchema = z.object({
  label: z.string().max(50, "Nhãn địa chỉ tối đa 50 ký tự").optional(),
  receiverName: z.string().min(1, "Nhập tên người nhận"),
  phone: z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số"),
  address: z.string().min(1, "Nhập địa chỉ giao hàng"),
  isDefault: z.boolean().optional(),
});
