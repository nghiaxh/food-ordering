import { describe, expect, it } from "vitest";
import { plain } from "../src/lib/text-normalizer.js";

// Chuẩn hoá tiếng Việt: tìm kiếm không dấu, không phân biệt hoa thường.
describe("text-normalizer", () => {
  it("bỏ dấu kết hợp và quy về chữ thường", () => {
    expect(plain("Phở bò")).toBe("pho bo");
    expect(plain("Bún bò Huế")).toBe("bun bo hue");
    expect(plain("Cơm gà xối mỡ")).toBe("com ga xoi mo");
  });

  it("đổi đ/Đ thủ công vì không có biểu diễn NFD", () => {
    expect(plain("Đồ uống")).toBe("do uong");
    expect(plain("Mì Quảng")).toBe("mi quang");
  });

  it("chịu null/undefined và khoảng trắng thừa", () => {
    expect(plain(null)).toBe("");
    expect(plain(undefined)).toBe("");
    expect(plain("  trà đào  ")).toBe("tra dao");
  });
});
