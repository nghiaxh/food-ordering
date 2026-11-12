import { z } from "zod";

export const promotionRequestSchema = z
  .object({
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
    // 0 = khong gioi han luot dung.
    usageLimit: z.number().int().min(0).nullable().optional(),
    // Han muc tong don toi thieu de KM duoc ap (null = khong gioi han).
    minOrderTotal: z.number().min(0, "Hạn mức đơn tối thiểu không được âm").nullable().optional(),
    randomCount: z.number().int().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.endsAt < v.startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "Thời gian kết thúc phải sau thời gian bắt đầu",
        path: ["endsAt"],
      });
    }
    // Pham vi CATEGORY/FOOD chi ap cho id da chon; danh sach rong thi khong khop mon nao.
    if (v.scope !== "GLOBAL" && (v.targetIds?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message:
          v.scope === "CATEGORY"
            ? "Chọn ít nhất một danh mục áp dụng"
            : "Chọn ít nhất một món áp dụng",
        path: ["targetIds"],
      });
    }
  });

export const promotionSaveSchema = z.object({
  settingKey: z.string().min(1),
  settingValue: z.string().min(1),
});