import { describe, it, expect } from "vitest";
import { scoreFood, scoreAll, WEIGHT } from "../src/user/chatbot/scoring.js";
import type { FoodWithCategory } from "../src/user/chatbot/plan.js";

const makeFood = (id: number, name: string, price: number, overrides: Partial<FoodWithCategory> = {}): FoodWithCategory =>
  ({
    id,
    name,
    price,
    available: true,
    spicyLevel: 0,
    servingSize: 1,
    ingredients: null,
    allergens: null,
    dietaryTags: null,
    category: null,
    ...overrides,
  } as unknown as FoodWithCategory);

describe("WEIGHT", () => {
  it("tong trong so bang 1", () => {
    const total = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });
});

describe("scoreFood", () => {
  it("khong tu khoa: keywordScore = 0", () => {
    const food = makeFood(1, "Pho bo", 45000);
    const { breakdown } = scoreFood(food, "an gi day", 100000, 5, [], 0, 0);
    expect(breakdown.keyword).toBe(0);
  });

  it("tu khoa khop ten mon: keywordScore > 0", () => {
    const food = makeFood(1, "Pho bo tai", 45000);
    const { breakdown } = scoreFood(food, "pho bo", 100000, 5, ["pho", "bo"], 0, 0);
    expect(breakdown.keyword).toBeGreaterThan(0);
  });

  it("DB chua co don: popularityScore = 0", () => {
    const food = makeFood(1, "Pho bo", 45000);
    const { breakdown } = scoreFood(food, "pho", 100000, 5, ["pho"], 0, 0);
    expect(breakdown.popularity).toBe(0);
  });

  it("khong co ngan sach: priceFitScore = 0.5", () => {
    const food = makeFood(1, "Pho bo", 45000);
    const { breakdown } = scoreFood(food, "pho", null, 5, ["pho"], 0, 0);
    expect(breakdown.priceFit).toBe(0.5);
  });

  it("diem trong [0, 1]", () => {
    const food = makeFood(1, "Pho bo", 45000);
    const { score } = scoreFood(food, "pho bo", 100000, 5, ["pho", "bo"], 5, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("scoreAll", () => {
  it("sap xep theo diem giam dan", () => {
    const foods = [
      makeFood(1, "Pho bo", 45000),
      makeFood(2, "Com tam", 35000),
    ];
    const candidates = foods.map((f) => ({ food: f, portions: 1, totalPrice: Number(f.price), matched: [] }));
    const scored = scoreAll(candidates, "pho", 100000, 5, ["pho"], new Map());
    expect(scored[0]!.food.name).toBe("Pho bo");
  });

  it("hoa diem thi id tang dan", () => {
    const foods = [
      makeFood(2, "Com tam", 40000),
      makeFood(1, "Bun rieu", 40000),
    ];
    const candidates = foods.map((f) => ({ food: f, portions: 1, totalPrice: Number(f.price), matched: [] }));
    const scored = scoreAll(candidates, "xyz", 100000, 5, [], new Map());
    // khong tu khoa, khong don -> tat ca bang diem, sort theo id
    expect(scored[0]!.food.id).toBe(1);
  });

  it("dao thu tu menu, ket qua khong doi", () => {
    const foods1 = [makeFood(1, "Pho bo", 45000), makeFood(2, "Com tam", 35000)];
    const foods2 = [makeFood(2, "Com tam", 35000), makeFood(1, "Pho bo", 45000)];
    const c1 = foods1.map((f) => ({ food: f, portions: 1, totalPrice: Number(f.price), matched: [] }));
    const c2 = foods2.map((f) => ({ food: f, portions: 1, totalPrice: Number(f.price), matched: [] }));
    const s1 = scoreAll(c1, "pho", 100000, 5, ["pho"], new Map());
    const s2 = scoreAll(c2, "pho", 100000, 5, ["pho"], new Map());
    expect(s1.map((s) => s.food.id)).toEqual(s2.map((s) => s.food.id));
  });
});
