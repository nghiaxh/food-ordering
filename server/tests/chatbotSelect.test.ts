import { describe, expect, it } from "vitest";
import type { Food, Category } from "../src/db/schema.js";
import {
  picked,
  selectFoods,
  selectFoodsByCode,
  type FoodWithCategory,
} from "../src/modules/chatbot/select.js";
import type { NormalizedCriteria } from "../src/modules/chatbot/criteria.js";
import { readFilters } from "../src/modules/chatbot/filters.js";

const cat = (id: number, name: string): Category => ({
  id,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  imageUrl: null,
  description: null,
});

const food = (
  id: number,
  name: string,
  category: Category,
  price: number,
  opts: {
    servingSize?: number;
    spicyLevel?: number;
    dietaryTags?: string | null;
    allergens?: string | null;
    ingredients?: string | null;
    available?: boolean;
  } = {},
): FoodWithCategory =>
  ({
    id,
    name,
    category,
    categoryId: category.id,
    description: null,
    ingredients: opts.ingredients ?? "nguyên liệu chung",
    price: price as never,
    imageUrl: null,
    servingSize: opts.servingSize ?? 1,
    spicyLevel: opts.spicyLevel ?? 0,
    dietaryTags: opts.dietaryTags ?? "",
    allergens: opts.allergens ?? "",
    available: opts.available ?? true,
    cartItems: [],
    orderItems: [],
    reviews: [],
  }) as FoodWithCategory;

const monViet = cat(1, "Món Việt");
const doUong = cat(2, "Đồ uống");
const monChay = cat(3, "Món chay");

const menu: FoodWithCategory[] = [
  food(1, "Phở bò", monViet, 65000, { servingSize: 1, spicyLevel: 0, allergens: "gluten" }),
  food(2, "Bún chả Hà Nội", monViet, 60000),
  food(3, "Bún bò Huế", monViet, 70000, { spicyLevel: 3, allergens: "gluten" }),
  food(4, "Gỏi cuốn tôm thịt", monViet, 45000, { servingSize: 2, allergens: "hải sản,đậu phộng" }),
  food(5, "Lẩu thái hải sản", monViet, 250000, { servingSize: 4, spicyLevel: 3, allergens: "hải sản" }),
  food(6, "Trà đào cam sả", doUong, 40000, { dietaryTags: "chay" }),
  food(7, "Nước cam ép", doUong, 35000, { dietaryTags: "chay,ít dầu mỡ" }),
  food(8, "Cà phê sữa đá", doUong, 30000, { allergens: "sữa" }),
  food(9, "Rau muống xào tỏi", monChay, 35000, { servingSize: 2, dietaryTags: "chay,ít dầu mỡ" }),
  food(10, "Đậu hũ sốt cà chua", monChay, 40000, { servingSize: 2, dietaryTags: "chay", allergens: "đậu nành" }),
];

const emptyCriteria = (overrides: Partial<NormalizedCriteria> = {}): NormalizedCriteria => ({
  categories: null,
  maxSpicyLevel: null,
  maxBudget: null,
  people: null,
  excludeAllergens: null,
  dietaryTags: null,
  keywords: null,
  ...overrides,
});

describe("selectFoods (AI criteria)", () => {
  it("lọc thuộc tính trước khi xét ngân sách", () => {
    const result = selectFoods(
      emptyCriteria({ maxSpicyLevel: 0 }),
      null,
      menu,
      5,
    );
    expect(result.every((p) => p.food.spicyLevel === 0)).toBe(true);
    // Không gợi ý món có hải sản nếu khách dị ứng hải sản.
    const noSeafood = selectFoods(
      emptyCriteria({ excludeAllergens: ["hải sản"] }),
      null,
      menu,
      5,
    );
    for (const p of noSeafood) {
      expect(`${p.food.allergens} ${p.food.ingredients}`).not.toContain("hải sản");
    }
  });

  it("chay: chỉ món có nhãn chay", () => {
    const result = selectFoods(emptyCriteria({ dietaryTags: ["chay"] }), null, menu, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.food.dietaryTags?.includes("chay"))).toBe(true);
  });

  it("ngân sách là TỔNG cả bộ gợi ý: tổng totalPrice ≤ maxBudget", () => {
    const result = selectFoods(emptyCriteria({ maxBudget: 100000 }), null, menu, 5);
    expect(result.length).toBeGreaterThan(0);
    const total = result.reduce((sum, p) => sum + p.totalPrice, 0);
    expect(total).toBeLessThanOrEqual(100000);
  });

  it("kết hợp 2 loại: một món chính, một món uống, tổng ≤ ngân sách", () => {
    const result = selectFoods(
      emptyCriteria({
        categories: [
          { name: "Món Việt", count: 1 },
          { name: "Đồ uống", count: 1 },
        ],
        maxBudget: 150000,
      }),
      null,
      menu,
      5,
    );
    expect(result.length).toBe(2);
    expect(result.some((p) => p.food.category?.name === "Món Việt")).toBe(true);
    expect(result.some((p) => p.food.category?.name === "Đồ uống")).toBe(true);
    const total = result.reduce((sum, p) => sum + p.totalPrice, 0);
    expect(total).toBeLessThanOrEqual(150000);
  });

  it("kết hợp 2 loại thiếu ứng viên thì trả rỗng khi có ngân sách (không lấy lệch loại)", () => {
    const onlyPho = menu.filter((f) => f.category?.name === "Món Việt");
    const result = selectFoods(
      emptyCriteria({
        categories: [
          { name: "Món Việt", count: 1 },
          { name: "Tráng miệng", count: 1 }, // menu không có tráng miệng
        ],
        maxBudget: 150000,
      }),
      null,
      onlyPho,
      5,
    );
    expect(result).toEqual([]);
  });

  it("hỏi tiếp: restrictIds chỉ xét đúng các món vừa gợi ý", () => {
    const result = selectFoods(
      emptyCriteria({ maxSpicyLevel: 0 }),
      [1, 3], // Phở bò và Bún bò Huế (cay) — chỉ Phở bò qua lọc
      menu,
      5,
    );
    expect(result.every((p) => [1, 3].includes(p.food.id))).toBe(true);
    expect(result.every((p) => p.food.spicyLevel === 0)).toBe(true);
  });
});

describe("picked / portions", () => {
  it("số phần = ceil(people / khẩu phần), tổng tiền = giá × số phần", () => {
    const p = picked(menu[0]!, 4); // Phở bò khẩu phần 1, 4 người → 4 phần
    expect(p.portions).toBe(4);
    expect(p.totalPrice).toBe(65000 * 4);
    const g = picked(menu[3]!, 4); // Gỏi cuốn khẩu phần 2, 4 người → 2 phần
    expect(g.portions).toBe(2);
    expect(g.totalPrice).toBe(45000 * 2);
  });
});

describe("selectFoodsByCode (fallback khi AI lỗi)", () => {
  it("chấm điểm theo từ khóa không dấu; ngoài lề thì không gợi ý món nào", () => {
    const filters = readFilters("Món chay không cay");
    const veg = selectFoodsByCode("Món chay không cay", filters, menu, 5);
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((p) => p.food.dietaryTags?.includes("chay"))).toBe(true);
    expect(veg.every((p) => p.food.spicyLevel === 0)).toBe(true);

    const out = selectFoodsByCode("Ai là Tổng thống Việt Nam?", readFilters("Ai là Tổng thống Việt Nam?"), menu, 5);
    expect(out).toEqual([]);
  });

  it("ngân sách là tổng cả bộ gợi ý kể cả ở nhánh dự phòng", () => {
    const filters = readFilters("Dưới 100k");
    const result = selectFoodsByCode("Gợi ý món dưới 100k", filters, menu, 5);
    const total = result.reduce((sum, p) => sum + p.totalPrice, 0);
    expect(total).toBeLessThanOrEqual(100000);
  });
});
