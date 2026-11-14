import { describe, expect, it } from "vitest";
import { sessionTitle } from "../src/user/chatbot/sessions.js";

describe("sessionTitle", () => {
  it("falls back when the session has no user message", () => {
    expect(sessionTitle(null)).toBe("Hội thoại mới");
    expect(sessionTitle("   ")).toBe("Hội thoại mới");
  });

  it("collapses whitespace and keeps short titles", () => {
    expect(sessionTitle("  Cho 2 người\n 200k ")).toBe("Cho 2 người 200k");
  });

  it("truncates long titles", () => {
    const title = sessionTitle("a".repeat(80));
    expect(title).toBe(`${"a".repeat(60)}...`);
    expect(title).toHaveLength(63);
  });
});
