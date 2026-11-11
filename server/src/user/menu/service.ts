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
