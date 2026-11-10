import { z } from "zod";

export const foodRequestSchema = z.object({
  name: z.string().min(1, "Tên món không được để trống"),
  categoryId: z.number().int().positive("Danh mục không hợp lệ"),
  description: z.string().max(1000).optional(),
  ingredients: z.string().max(1000).optional(),
  price: z.number().positive("Giá phải lớn hơn 0"),
  imageUrl: z.string().max(500).optional(),
  servingSize: z.number().int().min(1).optional(),
  spicyLevel: z.number().int().min(0).max(3).optional(),
  dietaryTags: z.string().max(255).optional(),
  allergens: z.string().max(255).optional(),
  available: z.boolean().optional(),
});

export const categoryRequestSchema = z.object({
  name: z.string().min(1, "Tên danh mục không được để trống"),
  slug: z.string().max(100).optional(),
  imageUrl: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

export const adminUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  // Mật khẩu để trống khi sửa = giữ mật khẩu hiện tại.
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").optional().or(z.literal("")),
  fullName: z.string().min(1, "Họ tên không được để trống"),
  phone: z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số").optional().or(z.literal("")),
  address: z.string().optional(),
});

export const promotionRequestSchema = z.object({
  name: z.string().min(1, "Tên khuyến mãi không được để trống"),
  description: z.string().max(500).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().positive("Giá trị giảm phải lớn hơn 0"),
  maxDiscount: z.number().positive().nullable().optional(),
  scope: z.enum(["GLOBAL", "CATEGORY", "FOOD"]),
  targetIds: z.array(z.number().int().positive()).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  daysOfWeek: z.string().max(20).nullable().optional(),
  startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Khung giờ không hợp lệ (HH:mm)").nullable().optional(),
  endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Khung giờ không hợp lệ (HH:mm)").nullable().optional(),
  active: z.boolean(),
  priority: z.number().int(),
  usageLimit: z.number().int().positive().nullable().optional(),
  randomCount: z.number().int().min(0),
}).refine((v) => v.endsAt >= v.startsAt, {
  message: "Thời gian kết thúc phải sau thời gian bắt đầu",
  path: ["endsAt"],
});

export const promotionSaveSchema = z.object({
  settingKey: z.string().min(1),
  settingValue: z.string().min(1),
});

export const documentRequestSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  category: z.string().max(100).nullish(),
  keywords: z.string().max(500).nullish(),
  content: z.string().min(1, "Nội dung không được để trống"),
  enabled: z.boolean(),
});

export const updateStatusRequestSchema = z.object({
  status: z.string().min(1, "Trạng thái không được để trống"),
});
