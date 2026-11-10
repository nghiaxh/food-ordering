import type { Category, Food } from "../generated/prisma/client.js";

export const toCategoryJson = (c: Category) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  imageUrl: c.imageUrl,
  description: c.description,
});

/**
 * Shape Food trả ra client. `discountedPrice`/`discountAmount`/`discountPercent`/`discountLabel`
 * là trường transient do lớp pricing điền lúc đọc; chưa có thì bỏ hẳn khỏi JSON.
 */
export const toFoodJson = (
  food: Food & { category?: Category | null },
  extras?: {
    discountedPrice?: number | null;
    discountAmount?: number | null;
    discountPercent?: number | null;
    discountLabel?: string | null;
  },
) => ({
  id: food.id,
  name: food.name,
  category: food.category ? toCategoryJson(food.category) : null,
  description: food.description,
  ingredients: food.ingredients,
  price: Number(food.price),
  imageUrl: food.imageUrl,
  servingSize: food.servingSize,
  spicyLevel: food.spicyLevel,
  dietaryTags: food.dietaryTags,
  allergens: food.allergens,
  available: food.available,
  ...(extras?.discountedPrice !== undefined && { discountedPrice: extras.discountedPrice }),
  ...(extras?.discountAmount !== undefined && { discountAmount: extras.discountAmount }),
  ...(extras?.discountPercent !== undefined && { discountPercent: extras.discountPercent }),
  ...(extras?.discountLabel !== undefined && { discountLabel: extras.discountLabel }),
});
