import { beforeEach, describe, expect, it, vi } from "vitest";

// Bien moi truong duoc parse luc import nen phai dat truoc khi nap module AI.
process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234";
process.env.AI_API_KEY = "test-key";
process.env.AI_MODEL = "gemini-test";

// Khong can CSDL: cau hinh AI lay tu bien moi truong khi ban ghi `ai_setting` co gia tri.
vi.mock("../src/lib/db.js", () => ({
  db: {
    query: {
      aiSetting: {
        findFirst: async () => undefined,
      },
    },
  },
}));

const gemini = await import("../src/lib/gemini.js");

const okBody = JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
const rateLimited = () => new Response("{}", { status: 429, headers: { "retry-after": "0" } });

describe("gemini chiu tai provider", () => {
  beforeEach(() => {
    gemini._resetKeyStateForTests();
    vi.unstubAllGlobals();
  });

  it("thu lai khi provider tra 429 roi tra ket qua", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls < 3) return rateLimited();
      return new Response(okBody, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gemini.generate("sys", "user", false)).resolves.toBe("ok");
    expect(calls).toBe(3);
  });

  it("khoa goi AI sau 429 de khong doi gap hanh che", async () => {
    const fetchMock = vi.fn(async () => rateLimited());
    vi.stubGlobal("fetch", fetchMock);

    await expect(gemini.generate("sys", "user", false)).rejects.toBeInstanceOf(gemini.AiRateLimitedException);
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBe(3);

    // Luot sau khong goi provider nua, tra loi ngay.
    await expect(gemini.generate("sys", "user", false)).rejects.toBeInstanceOf(gemini.AiRateLimitedException);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("khong retry loi khoa API", async () => {
    const fetchMock = vi.fn(async () => new Response("API_KEY_INVALID", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(gemini.generate("sys", "user", false)).rejects.toBeInstanceOf(gemini.AiKeyRejectedException);
    expect(fetchMock.mock.calls.length).toBe(1);
  });
});
