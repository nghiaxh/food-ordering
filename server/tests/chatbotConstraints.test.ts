import { describe, it, expect } from "vitest";
import { readConstraints, matchDishes, parseBudget, parsePeople } from "../src/user/chatbot/constraints.js";
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
    expect(ids).toContain(2);
  });

  it("khong khop neu ten khong trong cau", () => {
    const menu = [makeFood(1, "Pho bo tai")];
    const ids = matchDishes("toi muon com tam", menu);
    expect(ids).not.toContain(1);
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