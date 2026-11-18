import { describe, expect, it } from "vitest";
import { normalizeChat, plain } from "../src/lib/text-normalizer.js";

// Chuan hoa tieng Viet: tim kiem khong dau, khong phan biet hoa thuong.
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

// Teencode "ko cay" phai thanh "khong cay", neu khong chatbot tra ve mon cay.
describe("normalizeChat", () => {
  it("đổi teencode phủ định thành khong", () => {
    expect(normalizeChat("gợi ý món ko cay")).toBe("gợi ý món không cay");
    expect(normalizeChat("k cay")).toBe("không cay");
    expect(normalizeChat("hem cay nha")).toBe("không cay nha");
    expect(normalizeChat("KHONG thich do ngot")).toBe("KHONG thich do ngot");
  });

  it("giữ nguyên đơn vị tiền viết liền và gộp '100 k'", () => {
    expect(normalizeChat("2 người 100k")).toBe("2 người 100k");
    expect(normalizeChat("2 người 100 k")).toBe("2 người 100k");
  });

  it("giữ dấu câu cuối từ và không phá từ khác", () => {
    expect(normalizeChat("ko!")).toBe("không!");
    expect(normalizeChat("món kho")).toBe("món kho");
    expect(normalizeChat(null)).toBe("");
  });
});
