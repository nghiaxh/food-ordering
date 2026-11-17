import type { FoodWithCategory } from "./plan.js";
import type { Constraints } from "./constraints.js";

export type RejectReason = "UNAVAILABLE" | "SPICY" | "ALLERGEN" | "DIET" | "DISH_NAME";

export interface Candidate {
  food: FoodWithCategory;
  portions: number;
  totalPrice: number;
  matched: string[];
}

export interface FilterResult {
  kept: Candidate[];
  rejected: Array<{ reason: RejectReason; count: number }>;
}

/**
 * Loc cung (hard filter): loai mon vi pham rang buoc.
 * Tra ve ca danh sach mon qua cong va ly do loai.
 */
export function filterCandidates(
  menu: FoodWithCategory[],
  constraints: Constraints,
  people: number | null | undefined,
): FilterResult {
  const rejectedCounts: Record<RejectReason, number> = {
    UNAVAILABLE: 0,
    SPICY: 0,
    ALLERGEN: 0,
    DIET: 0,
    DISH_NAME: 0,
  };

  const kept: Candidate[] = [];

  for (const food of menu) {
    if (!food.available) {
      rejectedCounts.UNAVAILABLE++;
      continue;
    }
    if (constraints.spicyMax != null && food.spicyLevel > constraints.spicyMax) {
      rejectedCounts.SPICY++;
      continue;
    }
    if (constraints.spicyRequired && food.spicyLevel === 0) {
      rejectedCounts.SPICY++;
      continue;
    }
    const allergenHit = constraints.exclude.some(
      (e) =>
        (food.allergens ?? "").toLowerCase().includes(e.toLowerCase()) ||
        (food.ingredients ?? "").toLowerCase().includes(e.toLowerCase()),
    );
    if (allergenHit) {
      rejectedCounts.ALLERGEN++;
      continue;
    }
    if (constraints.diets.length > 0) {
      const hasAll = constraints.diets.every((d) =>
        (food.dietaryTags ?? "").toLowerCase().includes(d.toLowerCase()),
      );
      if (!hasAll) {
        rejectedCounts.DIET++;
        continue;
      }
    }
    if (constraints.dishes.length > 0 && !constraints.dishes.includes(food.id)) {
      rejectedCounts.DISH_NAME++;
      continue;
    }

    const portions = people && people > 0
      ? Math.ceil(people / Math.max(1, food.servingSize))
      : 1;

    const matched: string[] = [];
    if (constraints.chay) matched.push("chay");
    if (constraints.spicyMax === 0) matched.push("không cay");
    if (constraints.exclude.length > 0) matched.push(`không ${constraints.exclude.join(", ")}`);

    kept.push({
      food,
      portions,
      totalPrice: Number(food.price) * portions,
      matched,
    });
  }

  const rejected = (Object.entries(rejectedCounts) as [RejectReason, number][])
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count }));

  return { kept, rejected };
}