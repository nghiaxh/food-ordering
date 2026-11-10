import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
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
