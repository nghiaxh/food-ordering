import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { categories, cartItems, foods, orderItems } from "../../db/schema.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { plain } from "../../lib/text-normalizer.js";
import { toCategoryJson, toFoodJson } from "../../lib/serializers.js";
import { decorateFoods } from "../../user/pricing/service.js";


// Quan ly thuc don: tao, sua, xoa mon va danh muc; chan xoa mon da co trong don.
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
  if (!exists) throw notFound("Kh├┤ng t├¼m thß║Ñy danh mß╗Ñc");

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
    throw conflict("Danh mß╗Ñc c├▓n chß╗⌐a m├│n ─ân, kh├┤ng thß╗â x├│a");
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
  if (!category) throw badRequest("Danh mß╗Ñc kh├┤ng tß╗ôn tß║íi");

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
  if (!food) throw notFound("Kh├┤ng t├¼m thß║Ñy m├│n ─ân");

  const category = await db.query.categories.findFirst({
    where: eq(categories.id, req.categoryId),
    columns: { id: true },
  });
  if (!category) throw badRequest("Danh mß╗Ñc kh├┤ng tß╗ôn tß║íi");

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
  if (!food) throw notFound("Kh├┤ng t├¼m thß║Ñy m├│n ─ân");

  const inOrder = await db.query.orderItems.findFirst({
    where: eq(orderItems.foodId, id),
    columns: { id: true },
  });
  if (inOrder) {
    throw conflict(`M├│n "${food.name}" ─æang nß║▒m trong ─æ╞ín h├áng. H├úy chuyß╗ân sang trß║íng th├íi ngß╗½ng phß╗Ñc vß╗Ñ.`);
  }

  const inCart = await db.query.cartItems.findFirst({
    where: eq(cartItems.foodId, id),
    columns: { id: true },
  });
  if (inCart) {
    throw conflict(`M├│n "${food.name}" ─æang nß║▒m trong giß╗Å h├áng cß╗ºa kh├ích. H├úy chuyß╗ân sang trß║íng th├íi ngß╗½ng phß╗Ñc vß╗Ñ.`);
  }

  await db.delete(foods).where(eq(foods.id, id));
}
