// Chọn món bằng code xác định: lọc thuộc tính trước, rồi ghép/kiểm tra ngân sách tổng.
// AI chỉ diễn đạt sau khi danh sách món đã có; thẻ món luôn lấy ID/giá từ DB.

import type { Category, Food } from "../../generated/prisma/client.js";
import { plain } from "../../lib/text-normalizer.js";
import { passesFilters, significantWords, vnd, isFoodQuestion, type Filters } from "./filters.js";
import { wantedGroups, type NormalizedCriteria, type CategoryNeed } from "./criteria.js";

/** Số món ứng viên rẻ nhất xét cho bộ chọn phẳng khi có ngân sách. */
export const FLAT_CANDIDATES = 20;
/** Số món ứng viên giữ lại cho mỗi loại khi ghép tổ hợp. */
export const CANDIDATES_PER_GROUP = 5;

export type FoodWithCategory = Food & { category: Category | null };

export interface Picked {
  food: FoodWithCategory;
  portions: number;
  totalPrice: number;
}

export const portionsFor = (food: FoodWithCategory, people: number | null | undefined): number => {
  if (!people || people <= 0) return 1;
  const serving = Math.max(1, food.servingSize);
  return Math.ceil(people / serving);
};

export const picked = (food: FoodWithCategory, people: number | null | undefined): Picked => {
  const portions = portionsFor(food, people);
  return { food, portions, totalPrice: Number(food.price) * portions };
};

const hasAny = (field: string | null, words: string[] | null): boolean =>
  !!field && !!words?.some((w) => field.toLowerCase().includes(w.toLowerCase()));
const containsAll = (field: string | null, tags: string[]): boolean =>
  !!field && tags.every((t) => field.toLowerCase().includes(t.toLowerCase()));

const matchKeyword = (food: FoodWithCategory, keywords: string[]): boolean => {
  const text = `${food.name} ${food.ingredients ?? ""}`.toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
};

export const inCategory = (food: FoodWithCategory, categoryName: string): boolean =>
  !!food.category?.name && plain(food.category.name).includes(plain(categoryName));

/**
 * Chọn món theo tiêu chí. Bước 1 lọc thuộc tính, bước 2 ghép và kiểm tra ngân sách
 * TỔNG của cả bộ gợi ý (không phải giá từng món).
 */
export function selectFoods(
  criteria: NormalizedCriteria,
  restrictIds: number[] | null,
  menu: FoodWithCategory[],
  maxSuggestions: number,
): Picked[] {
  // Bước 1: lọc thuộc tính món; danh mục và giá để dành cho bước 2.
  let pool = menu.filter((food) => {
    if (!food.available) return false;
    if (restrictIds && !restrictIds.includes(food.id)) return false;
    if (criteria.maxSpicyLevel != null && food.spicyLevel > criteria.maxSpicyLevel) return false;
    if (hasAny(food.allergens, criteria.excludeAllergens)) return false;
    if (hasAny(food.ingredients, criteria.excludeAllergens)) return false;
    if (criteria.dietaryTags?.length && !containsAll(food.dietaryTags, criteria.dietaryTags)) return false;
    if (criteria.keywords?.length && !matchKeyword(food, criteria.keywords)) return false;
    return true;
  });
  if (pool.length === 0 && criteria.keywords?.length) {
    // Từ khóa AI trích xuất quá chat không khớp món nào: bỏ lọc từ khóa, vẫn giữ ràng buộc thuộc tính.
    pool = menu.filter((food) => {
      if (!food.available) return false;
      if (criteria.maxSpicyLevel != null && food.spicyLevel > criteria.maxSpicyLevel) return false;
      if (hasAny(food.allergens, criteria.excludeAllergens)) return false;
      if (hasAny(food.ingredients, criteria.excludeAllergens)) return false;
      if (criteria.dietaryTags?.length && !containsAll(food.dietaryTags, criteria.dietaryTags)) return false;
      return true;
    });
  }
  if (pool.length === 0) return [];

  // Câu hỏi tiếp không mở chủ đề mới nên không gom lại theo danh mục.
  const groups = restrictIds == null ? wantedGroups(criteria) : [];

  // Bước 2a: khách muốn kết hợp nhiều loại món ("một món chính và một món uống").
  if (groups.length >= 2) {
    const byGroup: Picked[][] = [];
    const found: CategoryNeed[] = [];
    for (const g of groups) {
      const inGroup = pool
        .filter((f) => inCategory(f, g.name))
        .map((f) => picked(f, criteria.people))
        .sort((a, b) => a.totalPrice - b.totalPrice)
        .slice(0, CANDIDATES_PER_GROUP);
      if (inGroup.length === 0) continue;
      byGroup.push(inGroup);
      found.push(g);
    }
    // Một nhóm thiếu ứng viên và có ngân sách: không đủ điều kiện ghép → trả rỗng,
    // giống tài liệu ARCHITECTURE ("không ghép được thì trả rỗng và câu trả lời nói rõ"),
    // thay vì trả một món lệch loại so với câu hỏi.
    if (found.length < groups.length && criteria.maxBudget != null) return [];
    const combo = combine(byGroup, found, criteria.maxBudget ?? null);
    if (found.length === groups.length && combo.length > 0) return combo;
    // Có ngân sách mà không ghép được đủ số món mỗi nhóm thì trả rỗng, không lấy lệch loại món khách yêu cầu.
    if (criteria.maxBudget != null) return [];
    if (combo.length > 0) return combo;
    // Không ngân sách và thiếu loại: rơi xuống chọn phẳng như cũ.
  }

  // Bước 2b: một loại món, hoặc khách không nói rõ loại nào.
  const first = groups[0];
  const candidates = (
    groups.length === 1 && first
      ? pool.filter((f) => inCategory(f, first.name)).map((f) => picked(f, criteria.people))
      : pool.map((f) => picked(f, criteria.people))
  );

  if (criteria.maxBudget != null) {
    return pickWithinTotalBudget(candidates, criteria.maxBudget, maxSuggestions);
  }
  return [...candidates].sort((a, b) => Number(a.food.price) - Number(b.food.price));
}

/**
 * Chọn 1..maxSuggestions món sao cho TỔNG tiền không vượt ngân sách và tổng tiền là lớn
 * nhất có thể. Chỉ dò trên 20 món rẻ nhất, bỏ trùng theo ID món. Hoà tổng thì ưu tiên nhiều món hơn.
 */
export const pickWithinTotalBudget = (candidates: Picked[], limit: number, maxItems: number): Picked[] => {
  const byId = new Map<number, Picked>();
  for (const p of candidates) if (!byId.has(p.food.id)) byId.set(p.food.id, p);
  const cheapest = [...byId.values()]
    .sort((a, b) => a.totalPrice - b.totalPrice)
    .slice(0, FLAT_CANDIDATES);
  let best: Picked[] = [];
  let bestTotal = -1;

  const search = (from: number, acc: Picked[], total: number) => {
    if (acc.length > 0 && (total > bestTotal || (total === bestTotal && acc.length > best.length))) {
      bestTotal = total;
      best = [...acc];
    }
    if (acc.length >= maxItems) return;
    for (let i = from; i < cheapest.length; i++) {
      const next = total + cheapest[i]!.totalPrice;
      if (next > limit) continue;
      acc.push(cheapest[i]!);
      search(i + 1, acc, next);
      acc.pop();
    }
  };
  search(0, [], 0);
  return best.sort((a, b) => Number(a.food.price) - Number(b.food.price));
};

/** Câu hỏi tiếp ở nhánh dự phòng: chỉ xét các món vừa gợi ý và áp ràng buộc đọc được. */
export const selectContextByCode = (
  ids: number[],
  filters: Filters,
  menu: FoodWithCategory[],
): Picked[] => {
  const kept = menu
    .filter((f) => f && ids.includes(f.id) && f.available)
    .map((f) => picked(f, filters.people))
    .filter((p) => passesFilters(p.food, filters, p.portions));
  if (filters.budget != null) {
    return pickWithinTotalBudget(kept, filters.budget, 5);
  }
  return kept.sort((a, b) => Number(a.food.price) - Number(b.food.price));
};

/**
 * Lọc món bằng code khi không gọi được AI: chấm điểm món theo từ khóa trùng tên/nguyên liệu/nhãn.
 * Không từ khóa nào trùng thì câu hỏi chung về món vẫn gợi ý vài món đang phục vụ,
 * câu hỏi ngoài lề thì không gợi ý gì.
 */
export const selectFoodsByCode = (
  question: string,
  filters: Filters,
  menu: FoodWithCategory[],
  maxSuggestions: number,
): Picked[] => {
  const words = significantWords(question);
  const p = plain(question);

  const scored = menu
    .filter((f) => f.available)
    .map((f) => {
      let score = 0;
      // Mô tả không tính vào điểm: câu "Ai là Tổng thống Việt Nam" sẽ khớp chữ "thống" trong
      // "truyền thống" và biến câu hỏi ngoài lề thành câu hỏi về món.
      const hay = plain(`${f.name} ${f.ingredients ?? ""} ${f.dietaryTags ?? ""}`);
      for (const w of words) if (hay.includes(w)) score++;
      // Tên danh mục chỉ tính khi câu hỏi có nguyên cụm tên danh mục.
      if (f.category?.name && p.includes(plain(f.category.name))) score++;
      return { food: f, score };
    })
    .filter((s) => s.score > 0);

  let candidates = scored;
  if (candidates.length === 0) {
    if (!isFoodQuestion(p)) return [];
    candidates = menu.filter((f) => f.available).map((f) => ({ food: f, score: 0 }));
  }

  const portion = (f: FoodWithCategory) => portionsFor(f, filters.people);
  let kept = candidates.filter((s) => passesFilters(s.food, filters, portion(s.food)));
  if (kept.length === 0 && candidates.length > 0) {
    // Món khớp từ khoá bị bộ lọc loại hết thì lấy trong toàn bộ món đang phục vụ, vẫn áp bộ lọc.
    kept = menu
      .filter((f) => f.available && passesFilters(f, filters, portion(f)))
      .map((f) => ({ food: f, score: 0 }));
  }

  kept.sort((a, b) => b.score - a.score || Number(a.food.price) - Number(b.food.price));
  const pickedList = kept.map((s) => picked(s.food, filters.people));
  if (filters.budget != null) {
    return pickWithinTotalBudget(pickedList, filters.budget, maxSuggestions);
  }
  return pickedList.slice(0, maxSuggestions);
};

/**
 * Dò tổ hợp ghép món từ nhiều loại sao cho tổng tiền không vượt ngân sách; ưu tiên tổ hợp
 * có tổng tiền lớn nhất. Toàn bộ trạng thái tìm kiếm gói trong một đối tượng.
 */
class BudgetCombiner {
  private best: Picked[] = [];
  private bestTotal = -1;
  private readonly limit: number;

  constructor(
    private readonly byGroup: Picked[][],
    private readonly groups: CategoryNeed[],
    maxBudget: number | null,
  ) {
    this.limit = maxBudget == null ? Number.MAX_SAFE_INTEGER : maxBudget;
  }

  find(): Picked[] {
    this.search(0, [], 0);
    return this.best;
  }

  private search(groupIndex: number, acc: Picked[], total: number) {
    if (total > this.limit) return;
    if (groupIndex === this.groups.length) {
      if (total > this.bestTotal) {
        this.bestTotal = total;
        this.best = [...acc];
      }
      return;
    }
    const candidates = this.byGroup[groupIndex]!;
    const needed = this.groups[groupIndex]?.count ?? 1;
    this.pick(candidates, groupIndex, 0, needed, acc, total);
  }

  private pick(candidates: Picked[], groupIndex: number, from: number, needed: number, acc: Picked[], total: number) {
    if (total > this.limit) return;
    if (needed === 0) {
      this.search(groupIndex + 1, acc, total);
      return;
    }
    for (let i = from; i < candidates.length; i++) {
      acc.push(candidates[i]!);
      this.pick(candidates, groupIndex, i + 1, needed - 1, acc, total + candidates[i]!.totalPrice);
      acc.pop();
    }
  }
}

const combine = (byGroup: Picked[][], groups: CategoryNeed[], maxBudget: number | null): Picked[] =>
  new BudgetCombiner(byGroup, groups, maxBudget).find();

/** Câu trả lời dựng bằng code khi không gọi được AI; chỉ tóm tắt ngắn vì thẻ món đã hiện ngay. */
export const fallbackReply = (dishes: Picked[], filters: Filters): string => {
  if (dishes.length === 0) {
    if (filters.budget != null) {
      return `Mình chưa tìm được món nào trong ngân sách ${vnd(filters.budget)}. Bạn thử nới ngân sách hoặc bỏ bớt điều kiện nhé!`;
    }
    return "Mình chỉ tư vấn được về món ăn của quán. Bạn xem thực đơn bên dưới nhé!";
  }

  const total = dishes.reduce((sum, p) => sum + p.totalPrice, 0);
  const described = describeFilters(filters);
  let reply = `Mình tìm được ${dishes.length} món`;
  if (described) reply += ` ${described}`;
  if (filters.budget != null) {
    reply += `, tổng ${vnd(total)}.`;
  } else {
    const minPrice = Math.min(...dishes.map((p) => Number(p.food.price)));
    reply += `, giá từ ${vnd(minPrice)}.`;
  }
  reply += "\n\nBấm vào thẻ món bên dưới để xem chi tiết và đặt món nhé!";
  return reply;
};

const describeFilters = (filters: Filters): string => {
  const parts: string[] = [];
  if (filters.chay) parts.push("chay");
  if (filters.maxSpicyLevel === 0) parts.push("không cay");
  if (filters.spicyRequired) parts.push("cay");
  if (filters.excludeSeafood) parts.push("không chứa hải sản");
  if (filters.budget != null) parts.push(`trong ngân sách ${vnd(filters.budget)}`);
  return parts.join(", ");
};
