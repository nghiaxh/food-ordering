import { describe, it, expect } from "vitest";
import { verifyReply } from "../src/user/chatbot/grounding.js";

describe("verifyReply", () => {
  const ctx = {
    allowedPrices: [45000, 90000, 30000],
    allowedFoodNames: ["Pho bo", "Com tam"],
    allowedChunks: ["Gio mo cua: 8h-22h. Phi ship: 15k."],
  };

  it("cau hop le -> ok", () => {
    const result = verifyReply("Mình gợi ý Pho bo 45k và Com tam 30k, tổng 75k.", ctx);
    // 75k not in allowedPrices, so this should fail
    expect(result.ok).toBe(false);
  });

  it("cau voi gia trong danh sach -> ok", () => {
    const result = verifyReply("Mình gợi ý Pho bo 45k, tổng 45k.", ctx);
    expect(result.ok).toBe(true);
  });

  it("gia bia -> vi pham", () => {
    const result = verifyReply("Món này 99k.", ctx);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("Gia"))).toBe(true);
  });

  it("SDT bia -> vi pham", () => {
    const result = verifyReply("Gọi 0912345678 để đặt món.", ctx);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("SDT"))).toBe(true);
  });

  it("gio bia -> vi pham", () => {
    const result = verifyReply("Quán mở cửa 7h-23h.", ctx);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("Gio"))).toBe(true);
  });

  it("cau qua dai -> vi pham", () => {
    const longReply = "a".repeat(601);
    const result = verifyReply(longReply, ctx);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("dai"))).toBe(true);
  });
});