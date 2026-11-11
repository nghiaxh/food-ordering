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