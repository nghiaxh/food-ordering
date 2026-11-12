import { plain } from "../../lib/text-normalizer.js";

// Rang buoc doc chac chan tu cau hoi (khong cay, chay, loai tru hai san,
// ngan sach, so nguoi) - dung cho ca loc mon lan cau tom tat trong cau tra loi du phong.
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

/** Cau hoi co chua tu nay thi moi coi la hoi ve mon an; hoi ngoai le thi khong goi y mon. */
const FOOD_QUESTION_WORDS = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes"];

export const isFoodQuestion = (plainText: string): boolean =>
  FOOD_QUESTION_WORDS.some((w) => plainText.includes(w));

/** So tien trong cau hoi: "100.000", "150k", "2 trieu", "50.000 dong". */
const MONEY = /(\d+(?:\.\d{3})+)|(?:(\d+)\s*(k|nghìn|nghin|ngan|ngàn|triệu|trieu))|(?:(\d+)\s*(đồng|dong|đ))/gi;
const PEOPLE = /(\d+)\s*(người|nguoi|people)/i;
/** So dung mot minh ("2") - chi co nghia khi bot vua hoi "may nguoi?". */
export const BARE_NUMBER = /^\s*(\d{1,2})\s*$/;

/** So nguoi an nam trong cau hoi, hoac null neu khach khong noi. */
export const parsePeople = (question: string): number | null => {
  const m = PEOPLE.exec(question);
  if (!m) return null;
  const people = Number(m[1]);
  return people > 0 ? people : null;
};

/** Ngan sach trong cau hoi, hoac null neu khach khong noi. Nhieu muc thi lay muc cao nhat. */
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

/** Doc cac rang buoc trong cau hoi; so khop bo dau de "khong cay" == "khong cay". */
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

/** Mon co vuot cac rang buoc khach neu trong cau hoi khong. */
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

/** Tu khoa cua cau hoi sau khi bo tu dung va tu qua ngan. */
export const significantWords = (question: string): string[] =>
  [...new Set(plain(question).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP_WORDS.has(w)))];

/** So tien kieu Viet Nam: 65.000d. */
export const vnd = (amount: number): string =>
  `${Math.round(amount).toLocaleString("vi-VN").replace(/,/g, ".")}đ`;
