// Ràng buộc đọc chắc chắn từ câu hỏi (không cay, chay, loại trừ hải sản, ngân sách,
// số người) — dùng cho cả lọc món lẫn câu tóm tắt trong câu trả lời dự phòng.

import { plain } from "../../lib/text-normalizer.js";

export interface Filters {
  maxSpicyLevel: number | null;
  spicyRequired: boolean;
  chay: boolean;
  excludeSeafood: boolean;
  budget: number | null;
  people: number | null;
}

const STOP_WORDS = new Set([
  "món", "mon", "nào", "nao", "gợi", "ý", "cho", "một", "mot", "các", "của", "cua",
  "hoặc", "không", "khong", "được", "duoc", "với", "voi", "muốn", "muon", "quán",
  "quan", "nhà", "nha", "hàng", "hang", "thế", "gì", "gi", "bao", "nhiêu", "nhieu",
  "dưới", "duoi", "trên", "khoảng", "khoang", "đến", "den", "theo", "người", "nguoi",
  "nhóm", "nhom", "nhé", "nhe", "sao", "đây", "day", "những", "nhung", "rất", "rat",
  "hơn", "hon", "cũng", "cung", "đều", "deu", "nữa", "nua", "vậy", "vay", "ngon",
  "nhất", "nhat", "phải", "phai", "nên", "nen", "hợp", "hop", "lực", "luc", "chọn",
  "chon", "đặt", "dat", "tôi", "toi", "cay", "thức", "thuc", "loại", "loai",
]);

/** Câu hỏi có chứa từ này thì mới coi là hỏi về món ăn; hỏi ngoài lề thì không gợi ý món. */
const FOOD_QUESTION_WORDS = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes"];

export const isFoodQuestion = (plainText: string): boolean =>
  FOOD_QUESTION_WORDS.some((w) => plainText.includes(w));

/** Số tiền trong câu hỏi: "100.000", "150k", "2 triệu", "50.000 đồng". */
const MONEY = /(\d+(?:\.\d{3})+)|(?:(\d+)\s*(k|nghìn|nghin|ngan|ngàn|triệu|trieu))|(?:(\d+)\s*(đồng|dong|đ))/gi;
const PEOPLE = /(\d+)\s*(người|nguoi|people)/i;
/** Số đứng một mình ("2") — chỉ có nghĩa khi bot vừa hỏi "mấy người?". */
export const BARE_NUMBER = /^\s*(\d{1,2})\s*$/;

/** Số người ăn nằm trong câu hỏi, hoặc null nếu khách không nói. */
export const parsePeople = (question: string): number | null => {
  const m = PEOPLE.exec(question);
  if (!m) return null;
  const people = Number(m[1]);
  return people > 0 ? people : null;
};

/** Ngân sách trong câu hỏi, hoặc null nếu khách không nói. Nhiều mức thì lấy mức cao nhất. */
export const parseBudget = (question: string): number | null => {
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
};

/** Đọc các ràng buộc trong câu hỏi; so khớp bỏ dấu để "khong cay" ≡ "không cay". */
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

const containsPlain = (field: string | null | undefined, word: string): boolean =>
  !!field && plain(field).includes(plain(word));

/** Món có vượt các ràng buộc khách nêu trong câu hỏi không. */
export const passesFilters = (
  food: { spicyLevel: number; dietaryTags: string | null; allergens: string | null; ingredients: string | null; price: number | { toString(): string } | null },
  filters: Filters,
  portions = 1,
): boolean => {
  if (filters.maxSpicyLevel != null && food.spicyLevel > filters.maxSpicyLevel) return false;
  if (filters.spicyRequired && food.spicyLevel === 0) return false;
  if (filters.chay && !containsPlain(food.dietaryTags, "chay")) return false;
  if (
    filters.excludeSeafood &&
    (containsPlain(food.allergens, "hải sản") || containsPlain(food.ingredients, "hải sản"))
  ) {
    return false;
  }
  if (filters.budget != null) {
    const price = Number(food.price);
    if (Number.isFinite(price) && price * portions > filters.budget) return false;
  }
  return true;
};

/** Từ khoá của câu hỏi sau khi bỏ từ dừng và từ quá ngắn. */
export const significantWords = (question: string): string[] =>
  [...new Set(plain(question).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP_WORDS.has(w)))];

/** Số tiền kiểu Việt Nam: 65.000đ. */
export const vnd = (amount: number): string =>
  `${Math.round(amount).toLocaleString("vi-VN").replace(/,/g, ".")}đ`;
