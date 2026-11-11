import { z } from "zod";

export const createReviewSchema = z.object({
  foodId: z.number().int().positive("Món ăn không hợp lệ"),
  rating: z.number().int().min(1, "Số sao tối thiểu là 1").max(5, "Số sao tối đa là 5"),
  comment: z.string().max(1000, "Nhận xét tối đa 1000 ký tự").optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1, "Số sao tối thiểu là 1").max(5, "Số sao tối đa là 5"),
  comment: z.string().max(1000, "Nhận xét tối đa 1000 ký tự").optional(),
});
