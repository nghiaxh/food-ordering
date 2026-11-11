import { describe, expect, it } from "vitest";
import {
  isFollowUp,
  isReferenceKeyword,
  normalizeCriteria,
} from "../src/user/chatbot/criteria.js";

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
