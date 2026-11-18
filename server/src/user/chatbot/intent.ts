// Cau chi duoc coi la hoi mon khi co tin hieu mon an. Khong co tin hieu thi tra loi
// ngoai pham vi luon, khong goi AI: model nho rat hay "gia vo" hieu cau lac de.
const FOOD_WORDS = new Set([
  "mon", "an", "menu", "ngon", "doi", "uong", "chay", "cay", "com", "pho", "bun", "mi",
  "banh", "lau", "nuong", "xao", "hap", "chien", "kho", "tra", "che", "ngot", "combo",
  "set", "rau", "thit", "tom", "ga", "bo", "heo", "ca", "trung", "dau", "nam", "goi",
  "cuon", "nuoc", "sinh", "to", "phe", "khoai", "muc", "ngheu", "so",
]);

const FOOD_PHRASES = [
  "thuc don", "goi y", "do an", "an gi", "nha hang", "quan an", "dat mon", "dat hang", "diem tam",
];

const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{5,}/;

/** Cau co nhac toi mon an / do uong khong (da chuan hoa khong dau). */
export function hasFoodSignal(p: string): boolean {
  if (FOOD_PHRASES.some((phrase) => p.includes(phrase))) return true;
  return p.split(/[^a-z0-9]+/).some((word) => FOOD_WORDS.has(word));
}

/** Chuoi go phim lung tung: co cum phu am dai ma tieng Viet khong bao gio co. */
export function looksLikeGibberish(p: string): boolean {
  const text = p.replace(/[^a-z\s]/g, " ").trim();
  if (!text) return true;
  return text.split(/\s+/).some((word) => CONSONANT_RUN.test(word));
}

/** Khach xin them mon khac: phai loai cac mon vua goi y chu khong lap lai chung. */
export function wantsMoreDishes(p: string): boolean {
  return ["mon khac", "mon nao khac", "goi y them", "them mon", "mon khac di"].some((k) => p.includes(k));
}

/** Khach noi ro toi cac mon vua goi y ("mon do", "may mon tren"): chi xet trong so do. */
export function refersToLastPicks(p: string): boolean {
  return ["mon do", "cai do", "mon nay", "mon vua", "may mon tren", "trong so do", "cac mon do"].some((k) =>
    p.includes(k),
  );
}
