import type { Category, Food } from "../../db/schema.js";
import { plain } from "../../lib/text-normalizer.js";
import { passesFilters, significantWords, vnd, isFoodQuestion, type Filters } from "./filters.js";
import { wantedGroups, type NormalizedCriteria, type CategoryNeed } from "./criteria.js";

/** So mon ung vien re nhat xet cho bo chon phang khi co ngan sach. */
export const FLAT_CANDIDATES = 20;
/** So mon ung vien giu lai cho moi loai khi ghep to hop. */
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
 * Chon mon theo tieu chi. Buoc 1 loc thuoc tinh, buoc 2 ghep va kiem tra ngan sach
 * TONG cua ca bo goi y (khong phai gia tung mon).
 */
// Chon mon bang code xac dinh: loc thuoc tinh truoc, roi ghep/kiem tra ngan sach tong.
// AI chi dien dat sau khi danh sach mon da co; the mon luon lay ID/gia tu DB.
export function selectFoods(
  criteria: NormalizedCriteria,
  restrictIds: number[] | null,
  menu: FoodWithCategory[],
  maxSuggestions: number,
): Picked[] {
  // Buoc 1: loc thuoc tinh mon; danh muc va gia de danh cho buoc 2.
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
    // Tu khoa AI trich xuat qua chat khong khop mon nao: bo loc tu khoa, van giu rang buoc thuoc tinh.
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

  // Cau hoi tiep khong mo chu de moi nen khong gom lai theo danh muc.
  const groups = restrictIds == null ? wantedGroups(criteria) : [];

  // Buoc 2a: khach muon ket hop nhieu loai mon ("mot mon chinh va mot mon uong").
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
    // Mot nhom thieu ung vien va co ngan sach: khong du dieu kien ghep -> tra rong,
    // giong tai lieu ARCHITECTURE ("khong ghep duoc thi tra rong va cau tra loi noi ro"),
    // thay vi tra mot mon lech loai so voi cau hoi.
    if (found.length < groups.length && criteria.maxBudget != null) return [];
    const combo = combine(byGroup, found, criteria.maxBudget ?? null);
    if (found.length === groups.length && combo.length > 0) return combo;
    // Co ngan sach ma khong ghep duoc du so mon moi nhom thi tra rong, khong lay lech loai mon khach yeu cau.
    if (criteria.maxBudget != null) return [];
    if (combo.length > 0) return combo;
    // Khong ngan sach va thieu loai: roi xuong chon phang nhu cu.
  }

  // Buoc 2b: mot loai mon, hoac khach khong noi ro loai nao.
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
 * Chon 1..maxSuggestions mon sao cho TONG tien khong vuot ngan sach va tong tien la lon
 * nhat co the. Chi do tren 20 mon re nhat, bo trung theo ID mon. Hoa tong thi uu tien nhieu mon hon.
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

/** Cau hoi tiep o nhanh du phong: chi xet cac mon vua goi y va ap rang buoc doc duoc. */
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
 * Loc mon bang code khi khong goi duoc AI: cham diem mon theo tu khoa trung ten/nguyen lieu/nhan.
 * Khong tu khoa nao trung thi cau hoi chung ve mon van goi y vai mon dang phuc vu,
 * cau hoi ngoai le thi khong goi y gi.
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
      // Mo ta khong tinh vao diem: cau "Ai la Tong thong Viet Nam" se khop chu "thong" trong
      // "truyen thong" va bien cau hoi ngoai le thanh cau hoi ve mon.
      const hay = plain(`${f.name} ${f.ingredients ?? ""} ${f.dietaryTags ?? ""}`);
      for (const w of words) if (hay.includes(w)) score++;
      // Ten danh muc chi tinh khi cau hoi co nguyen cum ten danh muc.
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
    // Mon khop tu khoa bi bo loc loai het thi lay trong toan bo mon dang phuc vu, van ap bo loc.
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
 * Do to hop ghep mon tu nhieu loai sao cho tong tien khong vuot ngan sach; uu tien to hop
 * co tong tien lon nhat. Toan bo trang thai tim kiem goi trong mot doi tuong.
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

/** Cau tra loi dung bang code khi khong goi duoc AI; chi tom tat ngan vi the mon da hien ngay. */
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
