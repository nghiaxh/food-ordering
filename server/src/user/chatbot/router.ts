import { plain } from "../../lib/text-normalizer.js";

export type Intent = "FOOD" | "INFO" | "GUIDE" | "GREETING" | "OUT_OF_SCOPE" | "FOLLOW_UP";

const GREETING_PHRASES = [
  "xin chao", "chao", "hello", "hi", "hey", "alo",
];

const INFO_KEYWORDS = [
  "mo cua", "dong cua", "gio mo", "gio dong", "dia chi", "o dau",
  "phi ship", "thoi gian giao", "sdt", "so dien thoai", "giao hang",
];

const GUIDE_KEYWORDS = [
  "cach dat", "dat mon", "dat hang", "thanh toan", "huy don",
  "don hang", "theo doi don", "xem don",
];

export function routeIntent(message: string): Intent {
  const p = plain(message);

  if (GREETING_PHRASES.some((g) => p === g || p.startsWith(`${g} `))) {
    const hasTopic = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "mo cua", "dia chi"].some((k) => p.includes(k));
    if (!hasTopic) return "GREETING";
  }

  if (GUIDE_KEYWORDS.some((k) => p.includes(k))) return "GUIDE";
  if (INFO_KEYWORDS.some((k) => p.includes(k))) return "INFO";

  const FOLLOW_UP_PHRASES = ["mon do", "cai do", "mon nay", "cai nay", "mon vua goi y", "mon vua roi", "may mon tren", "trong so do"];
  if (FOLLOW_UP_PHRASES.some((phrase) => p.includes(phrase))) return "FOLLOW_UP";

  const FOOD_WORDS = ["mon", "thuc don", "menu", "goi y", "an gi", "an gi day"];
  if (FOOD_WORDS.some((w) => p.includes(w))) return "FOOD";

  return "OUT_OF_SCOPE";
}

export function isDifferentRequest(message: string): boolean {
  const p = plain(message).replaceAll(/[^\p{L}\p{N} ]+/gu, " ").replaceAll(/\s+/g, " ").trim();
  return ["mon khac", "mon khac di", "khac di", "doi mon khac", "mon khac nha", "mon khac khong"].includes(p);
}