import { z } from "zod";
import { plain } from "../../lib/text-normalizer.js";
import type { FoodWithCategory } from "./plan.js";

// Rang buoc doc tu cau hoi (khong cay, chay, loai tru, ngan sach, so nguoi, ten mon).
export interface Constraints {
  spicyMax: number | null;
  spicyRequired: boolean;
  chay: boolean;
  exclude: string[];
  diets: string[];
  dishes: number[];
  groups: { name: string; count: number }[];
  budgetTotal: number | null;
  people: number | null;
  scope: "ALL" | "LAST_PICKS";
  restrictIds: number[] | null;
}

// Doc rang buoc tu cau hoi bang regex, khong goi AI.
export function readConstraints(question: string, menu: FoodWithCategory[]): Constraints {
  const p = plain(question);
  const noSpicy = p.includes("khong cay");
  const spicy = !noSpicy && p.includes("cay");
  const excludeSeafood = p.includes("hai san") && (p.includes("khong") || p.includes("di ung") || p.includes("tranh"));

  const exclude: string[] = [];
  if (excludeSeafood) exclude.push("hải sản");
  if (p.includes("khong hanh") || p.includes("di ung hanh")) exclude.push("hành");
  if (p.includes("khong toi") || p.includes("di ung toi")) exclude.push("tỏi");
  if (p.includes("khong dau phong") || p.includes("di ung dau phong")) exclude.push("đậu phộng");

  const diets: string[] = [];
  if (p.includes("chay")) diets.push("chay");

  // Doc ngan sach va so nguoi (tu filters.ts cu)
  const budget = parseBudget(question);
  const people = parsePeople(question);

  // Doc ten mon khach goi dich danh
  const dishes = matchDishes(question, menu);

  // Doc loai mon (nhom) tu cau: "mot mon chinh va mot mon uong"
  const groups: { name: string; count: number }[] = [];
  if (p.includes("mon chinh") || p.includes("mon man")) groups.push({ name: "món chính", count: 1 });
  if (p.includes("mon uong") || p.includes("nuoc uong") || p.includes("do uong")) groups.push({ name: "đồ uống", count: 1 });
  if (p.includes("mon khai vi") || p.includes("khai vi")) groups.push({ name: "khai vị", count: 1 });
  if (p.includes("mon trang mieng") || p.includes("trang mieng")) groups.push({ name: "tráng miệng", count: 1 });

  return {
    spicyMax: noSpicy ? 0 : null,
    spicyRequired: spicy,
    chay: p.includes("chay"),
    exclude,
    diets,
    dishes,
    groups,
    budgetTotal: budget,
    people,
    scope: "ALL",
    restrictIds: null,
  };
}

export const BARE_NUMBER = /^\s*(\d{1,2})\s*$/;

// Doc ngan sach tu cau hoi
export function parseBudget(question: string): number | null {
  const MONEY = /(\d+(?:\.\d{3})+)|(?:(\d+)\s*(k|nghìn|nghin|ngan|ngàn|triệu|trieu))|(?:(\d+)\s*(đồng|dong|đ))/gi;
  let best: number | null = null;
  MONEY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY.exec(question)) !== null) {
    let value: number;
    if (m[1]) value = Number(m[1].replace(/\./g, ""));
    else if (m[2]) {
      const base = Number(m[2]);
      const unit = (m[3] ?? "").toLowerCase();
      value = unit === "triệu" || unit === "trieu" ? base * 1_000_000 : base * 1_000;
    } else value = Number(m[4]);
    if (best === null || value > best) best = value;
  }
  return best;
}

// Doc so nguoi tu cau hoi
export function parsePeople(question: string): number | null {
  const PEOPLE = /(\d+)\s*(người|nguoi|people)/i;
  const m = PEOPLE.exec(question);
  if (!m) return null;
  const people = Number(m[1]);
  return people > 0 ? people : null;
}

/**
 * Tim ten mon khach goi dich danh trong cau.
 * Chieu so khop: TEN MON phai nam trong CAU (khong phai nguoc lai).
 * Chi nhan ten >= 2 tu hoac >= 5 ky tu.
 */
export function matchDishes(text: string, menu: FoodWithCategory[]): number[] {
  const p = plain(text);
  const matches: { id: number; len: number }[] = [];
  for (const food of menu) {
    const name = plain(food.name ?? "");
    if (name.length < 5 && name.split(" ").length < 2) continue;
    if (p.includes(name)) matches.push({ id: food.id, len: name.length });
  }
  // Ten dai thang ten ngan
  matches.sort((a, b) => b.len - a.len);
  const picked: number[] = [];
  for (const m of matches) {
    // Bo qua neu da co ten dai hon chua no (subsume)
    const subsumed = picked.some((id) => {
      const existing = matches.find((x) => x.id === id);
      return existing && existing.len > m.len && existing.len >= m.len + 2;
    });
    if (!subsumed) picked.push(m.id);
  }
  return picked;
}

export function isFoodQuestion(plainText: string): boolean {
  const FOOD_WORDS = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes"];
  return FOOD_WORDS.some((w) => plainText.includes(w));
}

export const vnd = (amount: number): string =>
  `${Math.round(amount).toLocaleString("vi-VN").replace(/,/g, ".")}đ`;

// --- Migrate tu criteria.ts ---

export const FOLLOW_UP_PHRASES = [
  "mon do", "cai do", "mon nay", "cai nay", "mon vua goi y", "mon vua roi",
  "may mon tren", "trong so do", "cac mon do", "nhung mon do", "mon tren",
];

export const REFERENCE_TOKENS = new Set([
  "mon", "cai", "do", "nay", "vua", "goi", "y", "tren", "may", "trong", "so",
  "cac", "nhung", "roi", "vay",
]);

export const isFollowUp = (message: string | null | undefined): boolean => {
  const p = plain(message ?? "");
  return FOLLOW_UP_PHRASES.some((phrase) => p.includes(phrase));
};

export const isReferenceKeyword = (keyword: string): boolean => {
  const p = plain(keyword).trim();
  if (!p) return true;
  return FOLLOW_UP_PHRASES.some((phrase) => p.includes(phrase))
    || p.split(/\s+/).every((token) => REFERENCE_TOKENS.has(token));
};

export type CategoryNeed = { name: string; count: number };

export const criteriaSchema = z
  .object({
    categories: z.array(z.object({ name: z.string(), count: z.number().int().nullable().optional() })).nullable().optional(),
    maxSpicyLevel: z.number().nullable().optional(),
    maxBudget: z.number().nullable().optional(),
    people: z.number().nullable().optional(),
    excludeAllergens: z.array(z.string()).nullable().optional(),
    dietaryTags: z.array(z.string()).nullable().optional(),
    keywords: z.array(z.string()).nullable().optional(),
  })
  .loose()
  .nullable()
  .optional();

export type CriteriaInput = z.infer<typeof criteriaSchema>;

export interface NormalizedCriteria {
  categories: CategoryNeed[] | null;
  maxSpicyLevel: number | null;
  maxBudget: number | null;
  people: number | null;
  excludeAllergens: string[] | null;
  dietaryTags: string[] | null;
  keywords: string[] | null;
}

export const normalizeCriteria = (raw: CriteriaInput): NormalizedCriteria | null => {
  if (!raw) return null;
  let spicy = raw.maxSpicyLevel;
  if (spicy != null && (spicy < 0 || spicy > 3)) spicy = null;
  let budget = raw.maxBudget;
  if (budget != null && budget <= 0) budget = null;
  let people = raw.people;
  if (people != null && (people <= 0 || people > 50)) people = null;
  const clean = (list: string[] | null | undefined): string[] | null => {
    if (!list) return null;
    const out = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
    return out.length ? out : null;
  };
  const keywords = (clean(raw.keywords) ?? []).filter((k) => !isReferenceKeyword(k));
  const groups = dedupeGroups(raw.categories);
  return {
    categories: groups.length ? groups : null,
    maxSpicyLevel: spicy ?? null,
    maxBudget: budget ?? null,
    people: people ?? null,
    excludeAllergens: clean(raw.excludeAllergens),
    dietaryTags: clean(raw.dietaryTags),
    keywords: keywords.length ? keywords : null,
  };
};

const dedupeGroups = (
  categories: Array<{ name: string; count?: number | null }> | null | undefined,
): CategoryNeed[] => {
  const groups: CategoryNeed[] = [];
  if (!categories) return groups;
  for (const g of categories) {
    if (!g?.name?.trim()) continue;
    const dup = groups.some((x) => x.name.toLowerCase() === g.name.trim().toLowerCase());
    if (dup) continue;
    const count = g.count == null || g.count < 1 ? 1 : g.count;
    groups.push({ name: g.name.trim(), count });
  }
  return groups;
};

export const wantedGroups = (c: NormalizedCriteria | null): CategoryNeed[] =>
  dedupeGroups(c?.categories ?? null);

// --- Migrate tu filters.ts ---

export interface Filters {
  maxSpicyLevel: number | null;
  spicyRequired: boolean;
  chay: boolean;
  excludeSeafood: boolean;
  budget: number | null;
  people: number | null;
}

export const readFilters = (question: string): Filters => {
  const p = plain(question);
  const noSpicy = p.includes("khong cay");
  const spicy = !noSpicy && p.includes("cay");
  const excludeSeafood =
    p.includes("hai san") && (p.includes("khong") || p.includes("di ung") || p.includes("tranh"));
  return {
    maxSpicyLevel: noSpicy ? 0 : null,
    spicyRequired: spicy,
    chay: p.includes("chay"),
    excludeSeafood,
    budget: parseBudget(question),
    people: parsePeople(question),
  };
};

export const significantWords = (question: string): string[] =>
  [...new Set(plain(question).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))];

export const passesFilters = (
  food: { spicyLevel: number; dietaryTags: string | null; allergens: string | null; ingredients: string | null; price: number | { toString(): string } | null },
  filters: Filters,
  portions = 1,
): boolean => {
  if (filters.maxSpicyLevel != null && food.spicyLevel > filters.maxSpicyLevel) return false;
  if (filters.spicyRequired && food.spicyLevel === 0) return false;
  if (filters.chay && !(food.dietaryTags ?? "").toLowerCase().includes("chay")) return false;
  if (filters.excludeSeafood && ((food.allergens ?? "").toLowerCase().includes("hải sản") || (food.ingredients ?? "").toLowerCase().includes("hải sản"))) return false;
  if (filters.budget != null) {
    const price = Number(food.price);
    if (Number.isFinite(price) && price * portions > filters.budget) return false;
  }
  return true;
};

// Merge constraints tu AI va regex. Regex thang cho budget/people/spicy.
export function mergeConstraints(
  ai: Partial<Constraints> | null,
  regex: Constraints,
): Constraints {
  return {
    spicyMax: regex.spicyMax ?? ai?.spicyMax ?? null,
    spicyRequired: regex.spicyRequired || (ai?.spicyRequired ?? false),
    chay: regex.chay || (ai?.chay ?? false),
    exclude: [...new Set([...(ai?.exclude ?? []), ...regex.exclude])],
    diets: [...new Set([...(ai?.diets ?? []), ...regex.diets])],
    dishes: regex.dishes.length > 0 ? regex.dishes : (ai?.dishes ?? []),
    groups: regex.groups.length > 0 ? regex.groups : (ai?.groups ?? []),
    budgetTotal: regex.budgetTotal ?? ai?.budgetTotal ?? null,
    people: regex.people ?? ai?.people ?? null,
    scope: regex.scope,
    restrictIds: regex.restrictIds,
  };
}