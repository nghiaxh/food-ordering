import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { plain } from "../../lib/text-normalizer.js";
import { toCategoryJson, toFoodJson } from "../../lib/serializers.js";
import { decorateFoods } from "../pricing/service.js";

/**
 * Tìm món: chỉ lọc thuộc tính tới được trong DB (danh mục, giá, còn bán). Từ khoá lọc bằng JS
 * qua text-normalizer để "pho bo" ra "Phở bò" mà không cần extension unaccent của PostgreSQL.
 */
export async function searchFoods(filter: {
  keyword?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
}) {
  const price =
    filter.minPrice !== undefined || filter.maxPrice !== undefined
      ? {
          ...(filter.minPrice !== undefined && { gte: filter.minPrice }),
          ...(filter.maxPrice !== undefined && { lte: filter.maxPrice }),
        }
      : undefined;
  const foods = await prisma.food.findMany({
    where: {
      ...(filter.categoryId !== undefined && { categoryId: filter.categoryId }),
      ...(price && { price }),
    },
    include: { category: true },
    orderBy: { id: "asc" },
  });
  const keyword = plain(filter.keyword);
  const matched = keyword ? foods.filter((f) => plain(f.name).includes(keyword)) : foods;
  const decorated = await decorateFoods(matched);
  return decorated.map((f) => toFoodJson(f));
}

export async function getFood(id: number) {
  const food = await prisma.food.findUnique({ where: { id }, include: { category: true } });
  if (!food) throw notFound("Không tìm thấy món ăn");
  const [decorated] = await decorateFoods([food]);
  return toFoodJson(decorated!);
}

export async function listCategories() {
  const categories = await prisma.category.findMany({ orderBy: { id: "asc" } });
  return categories.map(toCategoryJson);
}

export async function createCategory(req: { name: string; slug?: string; imageUrl?: string; description?: string }) {
  const created = await prisma.category.create({
    data: { name: req.name, slug: req.slug ?? null, imageUrl: req.imageUrl ?? null, description: req.description ?? null },
  });
  return toCategoryJson(created);
}

export async function updateCategory(id: number, req: { name: string; slug?: string; imageUrl?: string; description?: string }) {
  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("Không tìm thấy danh mục");
  const updated = await prisma.category.update({
    where: { id },
    data: { name: req.name, slug: req.slug ?? null, imageUrl: req.imageUrl ?? null, description: req.description ?? null },
  });
  return toCategoryJson(updated);
}

export async function deleteCategory(id: number) {
  const foods = await prisma.food.count({ where: { categoryId: id } });
  if (foods > 0) {
    throw conflict("Danh mục còn chứa món ăn, không thể xóa");
  }
  await prisma.category.delete({ where: { id } });
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
  const category = await prisma.category.findUnique({ where: { id: req.categoryId }, select: { id: true } });
  if (!category) throw badRequest("Danh mục không tồn tại");
  const created = await prisma.food.create({
    data: {
      name: req.name,
      categoryId: req.categoryId,
      description: req.description ?? null,
      ingredients: req.ingredients ?? null,
      price: req.price,
      imageUrl: req.imageUrl ?? null,
      servingSize: req.servingSize && req.servingSize > 0 ? req.servingSize : 1,
      spicyLevel: req.spicyLevel ?? 0,
      dietaryTags: req.dietaryTags ?? null,
      allergens: req.allergens ?? null,
      available: req.available ?? true,
    },
    include: { category: true },
  });
  return toFoodJson(created);
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
  const food = await prisma.food.findUnique({ where: { id }, select: { id: true } });
  if (!food) throw notFound("Không tìm thấy món ăn");
  const category = await prisma.category.findUnique({ where: { id: req.categoryId }, select: { id: true } });
  if (!category) throw badRequest("Danh mục không tồn tại");
  const updated = await prisma.food.update({
    where: { id },
    data: {
      name: req.name,
      categoryId: req.categoryId,
      description: req.description ?? null,
      ingredients: req.ingredients ?? null,
      price: req.price,
      imageUrl: req.imageUrl ?? null,
      servingSize: req.servingSize && req.servingSize > 0 ? req.servingSize : 1,
      spicyLevel: req.spicyLevel ?? 0,
      dietaryTags: req.dietaryTags ?? null,
      allergens: req.allergens ?? null,
      available: req.available ?? true,
    },
    include: { category: true },
  });
  return toFoodJson(updated);
}

/**
 * Món đã phát sinh đơn không xoá vật lý được, vì chi tiết đơn còn tham chiếu tới nó; admin phải
 * chuyển sang trạng thái ngừng phục vụ. Món còn nằm trong giỏ của khách cũng vậy.
 */
export async function deleteFood(id: number) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food) throw notFound("Không tìm thấy món ăn");
  const inOrder = await prisma.orderItem.findFirst({ where: { foodId: id }, select: { id: true } });
  if (inOrder) {
    throw conflict(`Món "${food.name}" đang nằm trong đơn hàng. Hãy chuyển sang trạng thái ngừng phục vụ.`);
  }
  const inCart = await prisma.cartItem.findFirst({ where: { foodId: id }, select: { id: true } });
  if (inCart) {
    throw conflict(`Món "${food.name}" đang nằm trong giỏ hàng của khách. Hãy chuyển sang trạng thái ngừng phục vụ.`);
  }
  await prisma.food.delete({ where: { id } });
}
