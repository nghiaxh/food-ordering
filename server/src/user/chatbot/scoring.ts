import type { FoodWithCategory } from "./plan.js";

// Trong so cho tung yeu to cham diem. Tong phai bang 1.
// Dung ten `weight` thay vi `w` de de doc va de bao cao.
export const WEIGHT = {
  keyword: 0.5,
  popularity: 0.3,
  priceFit: 0.2,
} as const;

// Kiem tong trong so = 1 khi module load.
const totalWeight = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
if (Math.abs(totalWeight - 1) > 1e-9) {
  throw new Error("WEIGHT phai tong bang 1");
}

export interface ScoreBreakdown {
  keyword: number;
  popularity: number;
  priceFit: number;
}

export interface ScoredCandidate {
  food: FoodWithCategory;
  portions: number;
  totalPrice: number;
  score: number;
  breakdown: ScoreBreakdown;
  matched: string[];
}

/**
 * Cham diem mot mon theo 3 yeu to: tu khoa, pho bien, gia phu hop.
 * Tra ve diem trong [0, 1] va breakdown.
 */
export function scoreFood(
  food: FoodWithCategory,
  query: string,
  budget: number | null,
  maxSuggestions: number,
  significantWords: string[],
  soldCount: number,
  maxSold: number,
): { score: number; breakdown: ScoreBreakdown } {
  // 1. Tu khoa: so tu khoa khop / tong tu khoa (0..1)
  let keywordRaw = 0;
  const namePlain = (food.name ?? "").toLowerCase();
  const ingredientsPlain = (food.ingredients ?? "").toLowerCase();
  const tagsPlain = (food.dietaryTags ?? "").toLowerCase();
  const categoryPlain = (food.category?.name ?? "").toLowerCase();

  for (const word of significantWords) {
    const w = word.toLowerCase();
    if (namePlain.includes(w)) keywordRaw += 3;
    if (ingredientsPlain.includes(w)) keywordRaw += 2;
    if (tagsPlain.includes(w)) keywordRaw += 1;
    if (categoryPlain.includes(w)) keywordRaw += 1;
  }
  const maxKeyword = significantWords.length > 0 ? significantWords.length * 3 : 1;
  const keywordScore = significantWords.length > 0
    ? Math.min(keywordRaw / maxKeyword, 1)
    : 0;

  // 2. Pho bien: sold / maxSold (0..1). DB moi chua co don -> 0.
  const popularityScore = maxSold > 0 ? soldCount / maxSold : 0;

  // 3. Gia phu hop: 1 - |gia - idealPrice| / budget (0..1). Khong co budget -> 0.5.
  let priceFitScore = 0.5;
  if (budget != null && budget > 0) {
    const idealPrice = budget / Math.max(1, maxSuggestions);
    const diff = Math.abs(Number(food.price) - idealPrice);
    priceFitScore = Math.max(0, 1 - diff / budget);
  }

  const score =
    WEIGHT.keyword * keywordScore +
    WEIGHT.popularity * popularityScore +
    WEIGHT.priceFit * priceFitScore;

  return {
    score,
    breakdown: {
      keyword: keywordScore,
      popularity: popularityScore,
      priceFit: priceFitScore,
    },
  };
}

/**
 * Cham diem tat ca mon sau khi qua cong cung (filterCandidates).
 * Tra ve mang ScoredCandidate sap xep theo diem giam dan, hoa thi id tang dan.
 */
export function scoreAll(
  candidates: { food: FoodWithCategory; portions: number; totalPrice: number; matched: string[] }[],
  query: string,
  budget: number | null,
  maxSuggestions: number,
  significantWordsList: string[],
  soldCounts: Map<number, number>,
): ScoredCandidate[] {
  const maxSold = Math.max(0, ...soldCounts.values());

  const scored = candidates.map((c) => {
    const soldCount = soldCounts.get(c.food.id) ?? 0;
    const { score, breakdown } = scoreFood(
      c.food,
      query,
      budget,
      maxSuggestions,
      significantWordsList,
      soldCount,
      maxSold,
    );
    return {
      food: c.food,
      portions: c.portions,
      totalPrice: c.totalPrice,
      score,
      breakdown,
      matched: c.matched,
    };
  });

  // Sap xep theo diem giam dan, hoa thi id tang dan (tat dinh)
  scored.sort((a, b) => b.score - a.score || a.food.id - b.food.id);

  return scored;
}