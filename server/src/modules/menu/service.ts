import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { categories, cartItems, foods, orderItems } from "../../db/schema.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { plain } from "../../lib/text-normalizer.js";
import { toCategoryJson, toFoodJson } from "../../lib/serializers.js";
import { decorateFoods } from "../pricing/service.js";

/**
 * Tim mon: chi loc thuoc tinh toi duoc trong DB (danh muc, gia, con ban). Tu khoa loc bang JS
 * qua text-normalizer de "pho bo" ra "Pho bo" ma khong can extension unaccent cua PostgreSQL.
 */
export async function searchFoods(filter: {
  keyword?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
}) {
  const conditions = [];
  if (filter.categoryId !== undefined) {
    conditions.push(eq(foods.categoryId, filter.categoryId));
  }
  if (filter.minPrice !== undefined) {
    conditions.push(gte(foods.price, String(filter.minPrice)));
  }
  if (filter.maxPrice !== undefined) {
    conditions.push(lte(foods.price, String(filter.maxPrice)));
  }

  const foodList = await db.query.foods.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { category: true },
    orderBy: [asc(foods.id)],
  });

  const keyword = plain(filter.keyword);
  const matched = keyword ? foodList.filter((f) => plain(f.name).includes(keyword)) : foodList;
  const decorated = await decorateFoods(matched);
  return decorated.map((f) => toFoodJson(f));
}

export async function getFood(id: number) {
  const food = await db.query.foods.findFirst({
    where: eq(foods.id, id),
    with: { category: true },
  });
  if (!food) throw notFound("Không tìm thấy món ăn");
  const [decorated] = await decorateFoods([food]);
  return toFoodJson(decorated!);
}

export async function listCategories() {
  const catList = await db.query.categories.findMany({
    orderBy: [asc(categories.id)],
  });
  return catList.map(toCategoryJson);
}

export async function createCategory(req: { name: string; slug?: string; imageUrl?: string; description?: string }) {
  const [created] = await db
    .insert(categories)
    .values({
      name: req.name,
      slug: req.slug ?? null,
      imageUrl: req.imageUrl ?? null,
      description: req.description ?? null,
    })
    .returning();
  return toCategoryJson(created!);
}

export async function updateCategory(id: number, req: { name: string; slug?: string; imageUrl?: string; description?: string }) {
  const exists = await db.query.categories.findFirst({
    where: eq(categories.id, id),
    columns: { id: true },
  });
  if (!exists) throw notFound("Không tìm thấy danh mục");

  const [updated] = await db
    .update(categories)
    .set({
      name: req.name,
      slug: req.slug ?? null,
      imageUrl: req.imageUrl ?? null,
      description: req.description ?? null,
    })
    .where(eq(categories.id, id))
    .returning();

  return toCategoryJson(updated!);
}

export async function deleteCategory(id: number) {
  const totalRows = await db
    .select({ value: count() })
    .from(foods)
    .where(eq(foods.categoryId, id));
  const foodCount = totalRows[0]?.value ?? 0;

  if (foodCount > 0) {
    throw conflict("Danh mục còn chứa món ăn, không thể xóa");
  }
  await db.delete(categories).where(eq(categories.id, id));
}

export async function createFood(req: {
  name: string;
  categoryId: number;
  description?: string;
  ingredients?: string;
  price: number;
  imageUrl?: string;
  servingSize?: number;
  spicyLevel?: number;
  dietaryTags?: string;
  allergens?: string;
  available?: boolean;
}) {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, req.categoryId),
    columns: { id: true },
  });
  if (!category) throw badRequest("Danh mục không tồn tại");

  const [created] = await db
    .insert(foods)
    .values({
      name: req.name,
      categoryId: req.categoryId,
      description: req.description ?? null,
      ingredients: req.ingredients ?? null,
      price: String(req.price),
      imageUrl: req.imageUrl ?? null,
      servingSize: req.servingSize && req.servingSize > 0 ? req.servingSize : 1,
      spicyLevel: req.spicyLevel ?? 0,
      dietaryTags: req.dietaryTags ?? null,
      allergens: req.allergens ?? null,
      available: req.available ?? true,
    })
    .returning();

  const withCat = await db.query.foods.findFirst({
    where: eq(foods.id, created!.id),
    with: { category: true },
  });
  return toFoodJson(withCat!);
}

export async function updateFood(id: number, req: {
  name: string;
  categoryId: number;
  description?: string;
  ingredients?: string;
  price: number;
  imageUrl?: string;
  servingSize?: number;
  spicyLevel?: number;
  dietaryTags?: string;
  allergens?: string;
  available?: boolean;
}) {
  const food = await db.query.foods.findFirst({
    where: eq(foods.id, id),
    columns: { id: true },
  });
  if (!food) throw notFound("Không tìm thấy món ăn");

  const category = await db.query.categories.findFirst({
    where: eq(categories.id, req.categoryId),
    columns: { id: true },
  });
  if (!category) throw badRequest("Danh mục không tồn tại");

  await db
    .update(foods)
    .set({
      name: req.name,
      categoryId: req.categoryId,
      description: req.description ?? null,
      ingredients: req.ingredients ?? null,
      price: String(req.price),
      imageUrl: req.imageUrl ?? null,
      servingSize: req.servingSize && req.servingSize > 0 ? req.servingSize : 1,
      spicyLevel: req.spicyLevel ?? 0,
      dietaryTags: req.dietaryTags ?? null,
      allergens: req.allergens ?? null,
      available: req.available ?? true,
    })
    .where(eq(foods.id, id));

  const updated = await db.query.foods.findFirst({
    where: eq(foods.id, id),
    with: { category: true },
  });
  return toFoodJson(updated!);
}

export async function deleteFood(id: number) {
  const food = await db.query.foods.findFirst({ where: eq(foods.id, id) });
  if (!food) throw notFound("Không tìm thấy món ăn");

  const inOrder = await db.query.orderItems.findFirst({
    where: eq(orderItems.foodId, id),
    columns: { id: true },
  });
  if (inOrder) {
    throw conflict(`Món "${food.name}" đang nằm trong đơn hàng. Hãy chuyển sang trạng thái ngừng phục vụ.`);
  }

  const inCart = await db.query.cartItems.findFirst({
    where: eq(cartItems.foodId, id),
    columns: { id: true },
  });
  if (inCart) {
    throw conflict(`Món "${food.name}" đang nằm trong giỏ hàng của khách. Hãy chuyển sang trạng thái ngừng phục vụ.`);
  }

  await db.delete(foods).where(eq(foods.id, id));
}
