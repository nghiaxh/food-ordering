import { describe, it, expect } from "vitest";
import { readConstraints, matchDishes, isFoodQuestion, parseBudget, parsePeople } from "../src/user/chatbot/constraints.js";
import { normalizeCriteria, isFollowUp, isReferenceKeyword } from "../src/user/chatbot/constraints.js";
import type { FoodWithCategory } from "../src/user/chatbot/constraints.js";

const makeFood = (id: number, name: string): FoodWithCategory =>
  ({ id, name, price: 45000, available: true, spicyLevel: 0, servingSize: 1, category: null }) as unknown as FoodWithCategory;

describe("readConstraints", () => {
  it("doc ngan sach", () => {
    const c = readConstraints("2 người 200k", []);
    expect(c.budgetTotal).toBe(200000);
    expect(c.people).toBe(2);
  });

  it("doc khong cay", () => {
    const c = readConstraints("mon chay khong cay", []);
    expect(c.spicyMax).toBe(0);
    expect(c.chay).toBe(true);
  });

  it("doc teencode ko cay nhu khong cay", () => {
    const c = readConstraints("gợi ý món ko cay dưới 100k cho 2 người", []);
    expect(c.spicyMax).toBe(0);
    expect(c.budgetTotal).toBe(100000);
    expect(c.people).toBe(2);
  });

  it("'khong chay' khong phai yeu cau mon chay", () => {
    const c = readConstraints("minh khong chay, an mon man", []);
    expect(c.chay).toBe(false);
    expect(c.diets).toEqual([]);
  });

  it("doc loai tru hai san", () => {
    const c = readConstraints("khong hai san", []);
    expect(c.exclude).toContain("hải sản");
  });

  it("doc ten mon", () => {
    const menu = [makeFood(1, "Pho bo tai"), makeFood(2, "Com tam")];
    const c = readConstraints("cho minh pho bo tai", menu);
    expect(c.dishes).toContain(1);
  });
});

describe("matchDishes", () => {
  it("ten mon nam trong cau", () => {
    const menu = [makeFood(1, "Pho bo tai"), makeFood(2, "Com tam")];
    const ids = matchDishes("toi muon pho bo tai", menu);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it("ten ngan khong khop nham ten dai", () => {
    const menu = [makeFood(1, "Pho"), makeFood(2, "Pho bo tai")];
    const ids = matchDishes("toi muon pho bo tai", menu);
    // "Pho bo tai" dai hon, "Pho" bi subsume
    expect(ids).toContain(2);
  });

  it("khong khop neu ten khong trong cau", () => {
    const menu = [makeFood(1, "Pho bo tai")];
    const ids = matchDishes("toi muon com tam", menu);
    expect(ids).not.toContain(1);
  });
});

describe("isFoodQuestion", () => {
  it("nhan ra cau hoi ve mon", () => {
    expect(isFoodQuestion("mon chay khong cay")).toBe(true);
    expect(isFoodQuestion("goi y mon")).toBe(true);
  });

  it("khong nhan cau ngoai le", () => {
    expect(isFoodQuestion("ai la tong thong")).toBe(false);
  });
});

describe("parseBudget", () => {
  it("doc 200k", () => {
    expect(parseBudget("200k")).toBe(200000);
  });
  it("doc 100.000", () => {
    expect(parseBudget("100.000")).toBe(100000);
  });
  it("doc 2 trieu", () => {
    expect(parseBudget("2 trieu")).toBe(2000000);
  });
});

describe("parsePeople", () => {
  it("doc 2 nguoi", () => {
    expect(parsePeople("2 nguoi")).toBe(2);
  });
  it("khong doc khi khong co", () => {
    expect(parsePeople("mon chay")).toBeNull();
  });
});

// AI co the tra ve them truong la, gia tri vo ly hoac tu khoa tham chieu thuan.
describe("normalizeCriteria", () => {
  it("chuẩn hóa tiêu chí hợp lệ, bỏ trường ngoài schema", () => {
    const result = normalizeCriteria({
      categories: [{ name: "Món Việt", count: 2 }],
      maxSpicyLevel: 1,
      maxBudget: 150000,
      people: 2,
      excludeAllergens: ["hải sản"],
      dietaryTags: ["chay"],
      keywords: ["phở"],
      // Truong la AI hay bia them:
      mucDoCay: "khong",
      note: "abc",
    });
    expect(result).toEqual({
      categories: [{ name: "Món Việt", count: 2 }],
      maxSpicyLevel: 1,
      maxBudget: 150000,
      people: 2,
      excludeAllergens: ["hải sản"],
      dietaryTags: ["chay"],
      keywords: ["phở"],
    });
  });

  it("loại giá trị vô lý: cay ngoài 0-3, budget ≤ 0, people ngoài 1-50", () => {
    const result = normalizeCriteria({
      maxSpicyLevel: 7,
      maxBudget: -1000,
      people: 0,
    });
    expect(result?.maxSpicyLevel).toBeNull();
    expect(result?.maxBudget).toBeNull();
    expect(result?.people).toBeNull();
  });

  it("bỏ từ khóa tham chiếu thuần ('món đó'...) và giữ từ khóa thật", () => {
    const result = normalizeCriteria({ keywords: ["món đó", "phở bò", "mấy món trên"] });
    expect(result?.keywords).toEqual(["phở bò"]);
  });

  it("dedupe categories theo tên, ép count ≥ 1", () => {
    const result = normalizeCriteria({
      categories: [
        { name: "Đồ uống", count: 1 },
        { name: "đồ uống", count: 5 },
        { name: "Món chay", count: 0 },
      ],
    });
    expect(result?.categories).toEqual([
      { name: "Đồ uống", count: 1 },
      { name: "Món chay", count: 1 },
    ]);
  });
});

describe("isFollowUp / isReferenceKeyword", () => {
  it("nhận ra đại từ tham chiếu rõ", () => {
    expect(isFollowUp("Món đó cay không?")).toBe(true);
    expect(isFollowUp("mấy món trên giá sao?")).toBe(true);
    expect(isFollowUp("Gợi ý món chay")).toBe(false);
  });

  it("từ đơn không phải chủ đề mới", () => {
    expect(isReferenceKeyword("món đó")).toBe(true);
    expect(isReferenceKeyword("trên")).toBe(true);
    expect(isReferenceKeyword("phở bò")).toBe(false);
  });
});
