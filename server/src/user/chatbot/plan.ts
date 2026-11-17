import type { Category, Food } from "../../db/schema.js";
import { plain } from "../../lib/text-normalizer.js";

export type FoodWithCategory = Food & { category: Category | null };

export interface Picked {
  food: FoodWithCategory;
  portions: number;
  totalPrice: number;
}

export interface Plan {
  picks: Picked[];
  totalPrice: number;
  groupsFilled: { name: string; count: number }[];
  groupsMissing: { name: string; count: number }[];
  rejected: Array<{ reason: string; count: number }>;
  rule: "BUDGET_FILL" | "GROUP_COMBO" | "CHEAPEST" | "POPULAR";
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

/** So mon ung vien re nhat xet cho bo chon phang khi co ngan sach. */
export const FLAT_CANDIDATES = 20;
/** So mon ung vien giu lai cho moi loai khi ghep to hop. */
export const CANDIDATES_PER_GROUP = 5;

const inCategory = (food: FoodWithCategory, categoryName: string): boolean =>
  !!food.category?.name && plain(food.category.name).includes(plain(categoryName));

/**
 * Chon 1..maxItems mon sao cho TONG tien khong vuot ngan sach va tong tien la lon
 * nhat co the. Chi do tren FLAT_CANDIDATES mon re nhat, bo trung theo ID mon.
 */
export const pickWithinTotalBudget = (
  candidates: Picked[],
  limit: number,
  maxItems: number,
): Picked[] => {
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

class BudgetCombiner {
  private best: Picked[] = [];
  private bestTotal = -1;
  private readonly limit: number;

  constructor(
    private readonly byGroup: Picked[][],
    private readonly groups: { name: string; count: number }[],
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

const combine = (byGroup: Picked[][], groups: { name: string; count: number }[], maxBudget: number | null): Picked[] =>
  new BudgetCombiner(byGroup, groups, maxBudget).find();

export interface CategoryNeed {
  name: string;
  count: number;
}

export const wantedGroups = (c: { categories: CategoryNeed[] | null }): CategoryNeed[] =>
  c.categories ?? [];

export function planSelection(
  candidates: Picked[],
  constraints: {
    maxBudget: number | null;
    people: number | null;
    groups: CategoryNeed[];
    restrictIds: number[] | null;
  },
  maxSuggestions: number,
): Plan {
  const groups = constraints.restrictIds == null ? constraints.groups : [];
  const rejected: Array<{ reason: string; count: number }> = [];

  // Nhom >= 2: ghep to hop
  if (groups.length >= 2) {
    const byGroup: Picked[][] = [];
    const found: CategoryNeed[] = [];
    for (const g of groups) {
      const inGroup = candidates
        .filter((p) => inCategory(p.food, g.name))
        .sort((a, b) => a.totalPrice - b.totalPrice)
        .slice(0, CANDIDATES_PER_GROUP);
      if (inGroup.length === 0) continue;
      byGroup.push(inGroup);
      found.push(g);
    }
    if (found.length < groups.length && constraints.maxBudget != null) {
      return { picks: [], totalPrice: 0, groupsFilled: found, groupsMissing: groups.filter((g) => !found.includes(g)), rejected: [{ reason: "CATEGORY", count: groups.length - found.length }], rule: "GROUP_COMBO" };
    }
    const combo = combine(byGroup, found, constraints.maxBudget);
    if (found.length === groups.length && combo.length > 0) {
      const total = combo.reduce((s, p) => s + p.totalPrice, 0);
      return { picks: combo.sort((a, b) => Number(a.food.price) - Number(b.food.price)), totalPrice: total, groupsFilled: found, groupsMissing: [], rejected, rule: "GROUP_COMBO" };
    }
    if (constraints.maxBudget != null) {
      return { picks: [], totalPrice: 0, groupsFilled: found, groupsMissing: groups.filter((g) => !found.includes(g)), rejected: [{ reason: "BUDGET", count: 1 }], rule: "GROUP_COMBO" };
    }
    if (combo.length > 0) {
      const total = combo.reduce((s, p) => s + p.totalPrice, 0);
      return { picks: combo.sort((a, b) => Number(a.food.price) - Number(b.food.price)), totalPrice: total, groupsFilled: found, groupsMissing: groups.filter((g) => !found.includes(g)), rejected, rule: "GROUP_COMBO" };
    }
  }

  // Nhom 1 hoac khong nhom: chon phang
  const first = groups[0];
  const filtered = groups.length === 1 && first
    ? candidates.filter((p) => inCategory(p.food, first.name))
    : candidates;

  if (constraints.maxBudget != null) {
    const picks = pickWithinTotalBudget(filtered, constraints.maxBudget, maxSuggestions);
    const total = picks.reduce((s, p) => s + p.totalPrice, 0);
    return { picks, totalPrice: total, groupsFilled: groups, groupsMissing: [], rejected, rule: "BUDGET_FILL" };
  }
  const sorted = [...filtered].sort((a, b) => Number(a.food.price) - Number(b.food.price)).slice(0, maxSuggestions);
  return { picks: sorted, totalPrice: sorted.reduce((s, p) => s + p.totalPrice, 0), groupsFilled: groups, groupsMissing: [], rejected, rule: "CHEAPEST" };
}

export function planLastPicks(
  ids: number[],
  constraints: { maxBudget: number | null; people: number | null },
  menu: FoodWithCategory[],
): Picked[] {
  const kept = menu
    .filter((f) => f && ids.includes(f.id) && f.available)
    .map((f) => picked(f, constraints.people))
    .filter((p) => {
      if (constraints.maxBudget != null && p.totalPrice > constraints.maxBudget) return false;
      return true;
    });
  if (constraints.maxBudget != null) {
    return pickWithinTotalBudget(kept, constraints.maxBudget, 5);
  }
  return kept.sort((a, b) => Number(a.food.price) - Number(b.food.price));
}