import { normalizeChat, plain } from "../../lib/text-normalizer.js";
import { readConstraints as readConstraintsRaw } from "./constraints.js";
import type { DishName } from "./constraints.js";

export type ChatIntent = "FOOD" | "RESTAURANT_INFO" | "ORDER_GUIDE" | "GREETING" | "THANKS" | "CONFIRM" | "OUT_OF_SCOPE";

export interface Criteria {
  budgetTotal: number | null;
  people: number | null;
  spicyMax: number | null;
  spicyRequired: boolean;
  diets: string[];
  exclude: string[];
  groups: string[];
  dishIds: number[];
}

export interface ParsedQuery {
  text: string;
  p: string;
  intent: ChatIntent;
  criteria: Criteria;
  more: boolean;
  onlyLast: boolean;
  gibberish: boolean;
}

const FOOD_WORDS = new Set([
  "mon", "an", "menu", "ngon", "doi", "uong", "chay", "cay", "com", "pho", "bun", "mi",
  "banh", "lau", "nuong", "xao", "hap", "chien", "kho", "tra", "che", "ngot", "combo",
  "set", "rau", "thit", "tom", "ga", "bo", "heo", "ca", "trung", "dau", "nam", "goi",
  "cuon", "nuoc", "sinh", "to", "phe", "khoai", "muc", "ngheu", "so",
]);

const FOOD_PHRASES = ["thuc don", "goi y", "do an", "an gi", "nha hang", "quan an", "dat mon", "dat hang", "diem tam"];

export function hasFoodSignal(p: string): boolean {
  if (FOOD_PHRASES.some((phrase) => p.includes(phrase))) return true;
  return p.split(/[^a-z0-9]+/).some((word) => FOOD_WORDS.has(word));
}

export function looksLikeGibberish(p: string): boolean {
  const text = p.replace(/[^a-z\s]/g, " ").trim();
  if (!text) return true;
  return text.split(/\s+/).some((word) => /[bcdfghjklmnpqrstvwxyz]{5,}/.test(word));
}

export function wantsMoreDishes(p: string): boolean {
  return ["mon khac", "mon nao khac", "goi y them", "them mon", "mon khac di"].some((k) => p.includes(k));
}

export function refersToLastPicks(p: string): boolean {
  return ["mon do", "cai do", "mon nay", "mon vua", "may mon tren", "trong so do", "cac mon do"].some((k) => p.includes(k));
}

export function isReferenceKeyword(keyword: string): boolean {
  const p = plain(keyword).trim();
  if (!p) return true;
  const FOLLOW_UP_PHRASES = ["mon do", "cai do", "mon nay", "cai nay", "mon vua goi y", "mon vua roi", "may mon tren", "trong so do", "cac mon do", "nhung mon do", "mon tren"];
  const REFERENCE_TOKENS = new Set(["mon", "cai", "do", "nay", "vua", "goi", "y", "tren", "may", "trong", "so", "cac", "nhung", "roi", "vay"]);
  if (FOLLOW_UP_PHRASES.some((phrase) => p.includes(phrase))) return true;
  return p.split(/\s+/).every((token) => REFERENCE_TOKENS.has(token));
}

export function readConstraints(question: string, menu: DishName[]): Criteria {
  const raw = readConstraintsRaw(question, menu);
  return {
    budgetTotal: raw.budgetTotal,
    people: raw.people,
    spicyMax: raw.spicyMax,
    spicyRequired: raw.spicyRequired,
    diets: raw.diets,
    exclude: raw.exclude,
    groups: raw.groups.map((g) => g.name),
    dishIds: raw.dishes,
  };
}

const isRestaurantInfoQuestion = (p: string): boolean =>
  ["mo cua", "dong cua", "gio mo", "gio dong", "o dia chi", "dia chi", "phi ship", "thoi gian giao", "giao hang o dau", "quan o dau", "sdt", "so dien thoai"].some((k) => p.includes(k));

const isOrderGuideQuestion = (p: string): boolean =>
  ["cach dat", "dat mon", "dat hang", "thanh toan", "huy don", "don hang", "trang thai don", "theo doi don", "xem don", "don cua toi", "giao hang the nao"].some((k) => p.includes(k));

const isGreetingQuestion = (p: string): boolean => {
  const hasTopic = ["mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes", "mo cua", "dia chi", "phi ship", "thanh toan", "huy don", "don hang"].some((k) => p.includes(k));
  if (hasTopic) return false;
  return ["xin chao", "chao", "chao ban", "hello", "hi", "hey", "alo"].some((g) => p === g || p.startsWith(`${g} `));
};

export function parseMessage(raw: string, menu: DishName[]): ParsedQuery {
  const text = normalizeChat(raw);
  const p = plain(text);

  if (p === "xac nhan" || p === "xacnhan" || p === "ok" || p === "dong y") {
    return { text, p, intent: "CONFIRM", criteria: emptyCriteria(), more: false, onlyLast: false, gibberish: false };
  }
  if (isRestaurantInfoQuestion(p)) {
    return { text, p, intent: "RESTAURANT_INFO", criteria: emptyCriteria(), more: false, onlyLast: false, gibberish: false };
  }
  if (isOrderGuideQuestion(p)) {
    return { text, p, intent: "ORDER_GUIDE", criteria: emptyCriteria(), more: false, onlyLast: false, gibberish: false };
  }
  if (isGreetingQuestion(p)) {
    return { text, p, intent: "GREETING", criteria: emptyCriteria(), more: false, onlyLast: false, gibberish: false };
  }
  if (["cam on", "thank", "thanks", "tam biet", "bye"].some((k) => p === k || p.startsWith(`${k} `))) {
    return { text, p, intent: "THANKS", criteria: emptyCriteria(), more: false, onlyLast: false, gibberish: false };
  }

  const regex = readConstraints(raw, menu);
  const hasConstraints = regex.budgetTotal != null || regex.people != null || regex.spicyMax != null
    || regex.spicyRequired || regex.exclude.length > 0
    || regex.diets.length > 0 || regex.groups.length > 0 || regex.dishIds.length > 0;

  const gib = looksLikeGibberish(p);
  if (gib || (!hasFoodSignal(p) && !hasConstraints)) {
    return { text, p, intent: "OUT_OF_SCOPE", criteria: regex, more: false, onlyLast: false, gibberish: gib };
  }

  return {
    text,
    p,
    intent: "FOOD",
    criteria: regex,
    more: wantsMoreDishes(p),
    onlyLast: refersToLastPicks(p),
    gibberish: false,
  };
}

function emptyCriteria(): Criteria {
  return { budgetTotal: null, people: null, spicyMax: null, spicyRequired: false, diets: [], exclude: [], groups: [], dishIds: [] };
}