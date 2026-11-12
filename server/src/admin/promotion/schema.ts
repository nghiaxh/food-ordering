import { z } from "zod";

export const promotionRequestSchema = z.object({
  name: z.string().min(1, "Tên khuyến mãi không được để trống"),
  description: z.string().max(500).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().positive("Giá trị giảm phải lớn hơn 0"),
  maxDiscount: z.number().positive().nullable().optional(),
  minOrderTotal: z.number().positive().nullable().optional(),
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