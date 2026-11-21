import { normalizeChat, plain } from "../../lib/text-normalizer.js";
import type { Category, Food } from "../../db/schema.js";

// Kieu dung chung cho mon an kem danh muc.
export type FoodWithCategory = Food & { category: Category | null };

// Chi can id + ten de doi chieu ten mon khach goi, khong keo ca ban ghi.
export type DishName = { id: number; name: string | null };

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
export function readConstraints(question: string, menu: DishName[]): Constraints {
  const text = normalizeChat(question);
  const p = plain(text);
  const noSpicy = p.includes("khong cay");
  const spicy = !noSpicy && p.includes("cay");
  const excludeSeafood = p.includes("hai san") && (p.includes("khong") || p.includes("di ung") || p.includes("tranh"));
  const vegetarian = p.includes("chay") && !p.includes("khong chay");

  const exclude: string[] = [];
  if (excludeSeafood) exclude.push("hải sản");
  if (p.includes("khong hanh") || p.includes("di ung hanh")) exclude.push("hành");
  if (p.includes("khong toi") || p.includes("di ung toi")) exclude.push("tỏi");
  if (p.includes("khong dau phong") || p.includes("di ung dau phong")) exclude.push("đậu phộng");

  const diets: string[] = [];
  if (vegetarian) diets.push("chay");

  const budget = parseBudget(text);
  const people = parsePeople(text);
  const dishes = matchDishes(text, menu);

  const groups: { name: string; count: number }[] = [];
  if (p.includes("mon chinh") || p.includes("mon man")) groups.push({ name: "món chính", count: 1 });
  if (p.includes("mon uong") || p.includes("nuoc uong") || p.includes("do uong")) groups.push({ name: "Đồ uống", count: 1 });
  if (p.includes("mon khai vi") || p.includes("khai vi")) groups.push({ name: "khai vị", count: 1 });
  if (p.includes("mon trang mieng") || p.includes("trang mieng")) groups.push({ name: "tráng miệng", count: 1 });

  return {
    spicyMax: noSpicy ? 0 : null,
    spicyRequired: spicy,
    chay: vegetarian,
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

export function parseBudget(question: string): number | null {
  const MONEY = /(\d+(?:\.\d{3})+)|(?:(\d+(?:\.\d+)?)\s*(k|nghìn|nghin|ngan|ngàn|triệu|trieu))|(?:(\d+)\s*(đồng|dong|đ))/gi;
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

export function parsePeople(question: string): number | null {
  const PEOPLE = /(\d+)\s*(người|nguoi|people)/i;
  const m = PEOPLE.exec(question);
  if (!m) return null;
  const people = Number(m[1]);
  return people > 0 ? people : null;
}

export function matchDishes(text: string, menu: DishName[]): number[] {
  const p = plain(text);
  const matches: { id: number; len: number }[] = [];
  for (const food of menu) {
    const name = plain(food.name ?? "");
    if (name.length < 5 && name.split(" ").length < 2) continue;
    if (p.includes(name)) matches.push({ id: food.id, len: name.length });
  }
  matches.sort((a, b) => b.len - a.len);
  const picked: number[] = [];
  for (const m of matches) {
    const subsumed = picked.some((id) => {
      const existing = matches.find((x) => x.id === id);
      return !!existing && existing.len > m.len && existing.len >= m.len + 2;
    });
    if (!subsumed) picked.push(m.id);
  }
  return picked;
}