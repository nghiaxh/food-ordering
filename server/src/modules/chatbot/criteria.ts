// Tiêu chí do AI trích xuất + zod kiểm tra lại; normalize để loại giá trị vô lý
// và bỏ từ khóa tham chiếu thuần ("món đó"...).

import { z } from "zod";
import { plain } from "../../lib/text-normalizer.js";

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
  // AI có thể trả về thêm trường lạ; bỏ qua chúng thay vì coi cả câu trả lời là lỗi.
  .loose()
  .nullable()
  .optional();

export type CriteriaInput = z.infer<typeof criteriaSchema>;
export type CategoryNeed = { name: string; count: number };

/** Tiêu chí đã chuẩn hóa: thiếu trường nào thì giữ null, không có undefined. */
export interface NormalizedCriteria {
  categories: CategoryNeed[] | null;
  maxSpicyLevel: number | null;
  maxBudget: number | null;
  people: number | null;
  excludeAllergens: string[] | null;
  dietaryTags: string[] | null;
  keywords: string[] | null;
}

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

/** Từ khóa AI có thể trả cho câu hỏi tiếp ("món đó"...) — không phải chủ đề mới. */
export const isReferenceKeyword = (keyword: string): boolean => {
  const p = plain(keyword).trim();
  if (!p) return true;
  return FOLLOW_UP_PHRASES.some((phrase) => p.includes(phrase))
    || p.split(/\s+/).every((token) => REFERENCE_TOKENS.has(token));
};

/** Chuẩn hóa tiêu chí AI trích xuất: bỏ giá trị vô lý, trim, bỏ từ khóa tham chiếu thuần. */
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
