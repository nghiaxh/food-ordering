import { z } from "zod";

export const addCartItemSchema = z.object({
  foodId: z.number().int().positive("Món ăn không hợp lệ"),
  quantity: z.number().int().min(1, "Số lượng món phải lớn hơn 0"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, "Số lượng món phải lớn hơn 0"),
});

/**
 * Quote tính trên danh sách dòng client đang hiển thị, không đọc lại giỏ DB —
 * nhờ vậy số khách thấy luôn khớp con số dùng lúc tạo đơn.
 */
export const quoteRequestSchema = z.object({
  items: z
    .array(z.object({ foodId: z.number().int().positive("Món ăn không hợp lệ"), quantity: z.number().int().min(1) }))
    .min(1, "Giỏ hàng rỗng"),
});
