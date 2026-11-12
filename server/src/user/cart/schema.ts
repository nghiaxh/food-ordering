import { z } from "zod";

export const addCartItemSchema = z.object({
  foodId: z.number().int().positive("Món ăn không hợp lệ"),
  quantity: z.number().int().min(1, "Số lượng món phải lớn hơn 0"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, "Số lượng món phải lớn hơn 0"),
});

/**
 * Quote tinh tren danh sach dong client dang hien thi, khong doc lai gio DB -
 * nho vay so khach thay luon khop con so dung luc tao don.
 */
export const quoteRequestSchema = z.object({
  items: z
    .array(z.object({ foodId: z.number().int().positive("Món ăn không hợp lệ"), quantity: z.number().int().min(1) }))
    .min(1, "Giỏ hàng rỗng"),
});
