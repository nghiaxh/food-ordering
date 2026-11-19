import { describe, it, expect } from "vitest";
import { parseList, supportsThinking } from "../src/lib/aiModels.js";

describe("parseList", () => {
  it("mot gia tri van thanh mang", () => {
    expect(parseList("gemini-3.1-flash-lite")).toEqual(["gemini-3.1-flash-lite"]);
  });

  it("tach dau phay va xuong dong", () => {
    expect(parseList("a, b\nc")).toEqual(["a", "b", "c"]);
  });

  it("bo khoang trang va trung lap", () => {
    expect(parseList(" a ,, a \n b ")).toEqual(["a", "b"]);
  });

  it("rong -> mang rong", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
});

describe("supportsThinking", () => {
  it("flash ban day du nhan thinkingConfig", () => {
    expect(supportsThinking("gemini-3.6-flash")).toBe(true);
    expect(supportsThinking("gemini-3.5-flash")).toBe(true);
  });

  it("lite va image khong nhan thinkingConfig", () => {
    expect(supportsThinking("gemini-3.1-flash-lite")).toBe(false);
    expect(supportsThinking("gemini-3.5-flash-lite")).toBe(false);
    expect(supportsThinking("gemini-3.1-flash-image")).toBe(false);
  });
});
