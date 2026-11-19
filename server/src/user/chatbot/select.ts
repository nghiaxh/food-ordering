import { and, asc, eq, inArray, lte, gt, sql, ilike, or, notInArray, type SQL } from "drizzle-orm";
import { foods } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { plain } from "../../lib/text-normalizer.js";
import type { FoodWithCategory } from "./constraints.js";
import type { Criteria } from "./parse.js";

export interface SelectedDish {
  food: FoodWithCategory;
}

const DRINK_DESSERT_SLUGS = new Set(["do-uong", "trang-mieng"]);

const asksForDrinkOrDessert = (criteria: Criteria): boolean => {
  const text = plain([...criteria.groups, ...criteria.dishIds.map(String)].join(" "));
  return ["uong", "tra", "ca phe", "sinh to", "nuoc", "che", "banh", "trang mieng", "dessert"].some((k) => text.includes(k));
};

const perDishCap = (criteria: Criteria): number | null => {
  if (!criteria.budgetTotal || criteria.budgetTotal <= 0) return null;
  const people = Math.max(1, criteria.people ?? 1);
  return Math.max(1, Math.floor(criteria.budgetTotal / people));
};

export const filterMenu = async (criteria: Criteria, options: { lastFoodIds?: number[] | null; excludeIds?: number[]; restrictToLast?: boolean; restrictIds?: number[] }): Promise<FoodWithCategory[]> => {
  const whereConditions: SQL[] = [eq(foods.available, true)];

  if (options.restrictToLast && options.lastFoodIds?.length) {
    whereConditions.push(inArray(foods.id, options.lastFoodIds));
  }
  if (options.restrictIds?.length) {
    whereConditions.push(inArray(foods.id, options.restrictIds));
  }
  if (options.excludeIds?.length) {
    whereConditions.push(notInArray(foods.id, options.excludeIds));
  }
  if (criteria.spicyMax != null) whereConditions.push(lte(foods.spicyLevel, criteria.spicyMax));
  if (criteria.spicyRequired) whereConditions.push(gt(foods.spicyLevel, 0));
  if (criteria.spicyMax === 0) {
    whereConditions.push(sql`${foods.name} NOT ILIKE ${"%ớt%"}`);
    whereConditions.push(sql`${foods.ingredients} NOT ILIKE ${"%ớt%"}`);
  }
  const cap = perDishCap(criteria);
  if (cap != null) whereConditions.push(sql`${foods.price}::numeric <= ${cap}`);
  if (criteria.exclude?.length) {
    for (const a of criteria.exclude) {
      whereConditions.push(sql`${foods.allergens} NOT ILIKE ${"%" + a + "%"}`);
      whereConditions.push(sql`${foods.ingredients} NOT ILIKE ${"%" + a + "%"}`);
    }
  }
  if (criteria.diets?.length) {
    for (const d of criteria.diets) {
      whereConditions.push(sql`${foods.dietaryTags} ILIKE ${"%" + d + "%"}`);
    }
  }
  if (criteria.dishIds?.length) {
    whereConditions.push(inArray(foods.id, criteria.dishIds));
  }

  const rows = await db.query.foods.findMany({
    where: and(...whereConditions),
    with: { category: true },
    orderBy: [asc(foods.price)],
    limit: 40,
  }) as FoodWithCategory[];

  let result = rows.filter((f) => f.available);

  if (!asksForDrinkOrDessert(criteria)) {
    const mains = result.filter((f) => !DRINK_DESSERT_SLUGS.has(f.category?.slug ?? ""));
    if (mains.length > 0) result = mains;
  }

  if (criteria.groups?.length) {
    const wanted = criteria.groups.map((c) => plain(c));
    const matched = result.filter((f) => {
      const name = plain(f.category?.name ?? "");
      if (!name) return false;
      return wanted.some((c) => name.includes(c) || c.includes(name));
    });
    if (matched.length > 0) result = matched;
  }

  return result.slice(0, 40);
};

export const buildCards = (foods: FoodWithCategory[], maxSugg: number): { id: number; name: string; imageUrl: string | null; categoryName: string | null }[] => {
  return foods.slice(0, maxSugg).map((f) => ({
    id: f.id,
    name: f.name,
    imageUrl: f.imageUrl,
    categoryName: f.category?.name ?? null,
  }));
};

export const quickRepliesFor = (cards: { id: number }[]): string[] => {
  return cards.length > 0 ? ["Món khác", "Món chay không cay"] : ["Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?"];
};

export { perDishCap, asksForDrinkOrDessert };