import { describe, it, expect } from "vitest";
import { dropTrailingQuestion, hasForeignScript, limitSentences, verifyReply } from "../src/user/chatbot/grounding.js";

describe("verifyReply", () => {
  it("cau ngan -> ok", () => {
    const result = verifyReply("Mình gợi ý Pho bo và Com tam.");
    expect(result.ok).toBe(true);
  });

  it("cau qua dai -> vi pham", () => {
    const longReply = "a".repeat(801);
    const result = verifyReply(longReply);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("dai"))).toBe(true);
  });

  it("cau 800 ky tu -> ok", () => {
    const reply = "a".repeat(800);
    const result = verifyReply(reply);
    expect(result.ok).toBe(true);
  });
});

// Model 4B thinh thoang doi ngon ngu giua cau; phai phat hien de goi lai thay vi hien cho khach.
describe("hasForeignScript", () => {
  it("cau tieng Viet co dau -> khong sao", () => {
    expect(hasForeignScript("Tôi gợi ý quý khách món Gỏi cuốn 45.000đ.")).toBe(false);
    expect(hasForeignScript("Giá 45.000đ, mời quý khách bấm thẻ món.")).toBe(false);
  });

  it("phat hien chu Thai, Trung, Nhat, Han", () => {
    expect(hasForeignScript("Nấm xào sả ớt ราคา 45.000đ")).toBe(true);
    expect(hasForeignScript("Món này 很好吃")).toBe(true);
    expect(hasForeignScript("おすすめの料理")).toBe(true);
    expect(hasForeignScript("추천 메뉴")).toBe(true);
  });
});

describe("dropTrailingQuestion", () => {
  it("bo cau hoi o cuoi", () => {
    expect(dropTrailingQuestion("Tôi gợi ý phở bò. Quý khách có muốn đặt không?")).toBe("Tôi gợi ý phở bò.");
  });

  it("giu nguyen khi cau duy nhat la cau hoi", () => {
    expect(dropTrailingQuestion("Quý khách muốn ăn gì?")).toBe("Quý khách muốn ăn gì?");
  });

  it("giu cau tra loi binh thuong", () => {
    const reply = "Tôi gợi ý phở bò 45.000đ. Quý khách bấm thẻ món để đặt.";
    expect(dropTrailingQuestion(reply)).toBe(reply);
  });
});

describe("limitSentences", () => {
  it("cat con 4 cau", () => {
    expect(limitSentences("Một. Hai. Ba. Bốn. Năm.")).toBe("Một. Hai. Ba. Bốn.");
  });

  it("them dau cham khi cau cuoi thieu", () => {
    expect(limitSentences("Tôi gợi ý phở bò")).toBe("Tôi gợi ý phở bò.");
  });
});
