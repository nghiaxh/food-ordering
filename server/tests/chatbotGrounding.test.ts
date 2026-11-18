import { describe, it, expect } from "vitest";
import { verifyReply } from "../src/user/chatbot/grounding.js";

describe("verifyReply", () => {
  const ctx = {
    allowedPrices: [45000, 90000, 30000],
    allowedFoodNames: ["Pho bo", "Com tam"],
    allowedChunks: ["Gio mo cua: 8h-22h. Phi ship: 15k."],
  };

  it("cau ngan -> ok", () => {
    const result = verifyReply("Mình gợi ý Pho bo 45k và Com tam 30k.", ctx);
    expect(result.ok).toBe(true);
  });

  it("cau qua dai -> vi pham", () => {
    const longReply = "a".repeat(801);
    const result = verifyReply(longReply, ctx);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("dai"))).toBe(true);
  });

  it("cau 800 ky tu -> ok", () => {
    const reply = "a".repeat(800);
    const result = verifyReply(reply, ctx);
    expect(result.ok).toBe(true);
  });
});