import { describe, expect, it } from "vitest";
import { hasFoodSignal, looksLikeGibberish, refersToLastPicks, wantsMoreDishes } from "../src/user/chatbot/intent.js";

// Cau khong co tin hieu mon an phai bi chan truoc khi goi AI, neu khong tro ly
// tra ve the mon cho ca cau hoi ngoai pham vi ("hom nay la thu may").
describe("hasFoodSignal", () => {
  it("nhan cau hoi mon an", () => {
    expect(hasFoodSignal("goi y mon cho 2 nguoi")).toBe(true);
    expect(hasFoodSignal("mon chay khong cay")).toBe(true);
    expect(hasFoodSignal("com ga xoi mo")).toBe(true);
    expect(hasFoodSignal("minh doi qua")).toBe(true);
    expect(hasFoodSignal("co gi uong khong")).toBe(true);
  });

  it("khong nhan cau ngoai pham vi", () => {
    expect(hasFoodSignal("hom nay la thu may")).toBe(false);
    expect(hasFoodSignal("ban ten la gi")).toBe(false);
    expect(hasFoodSignal("thoi tiet the nao")).toBe(false);
  });
});

describe("looksLikeGibberish", () => {
  it("nhan chuoi go phim lung tung", () => {
    expect(looksLikeGibberish("adwlkdawlda")).toBe(true);
    expect(looksLikeGibberish("asdfghjkl")).toBe(true);
  });

  it("cau tieng Viet binh thuong khong bi coi la rac", () => {
    expect(looksLikeGibberish("goi y mon cho 2 nguoi")).toBe(false);
    expect(looksLikeGibberish("nghien cuu cai thien chatbot")).toBe(false);
    expect(looksLikeGibberish("khong cay nha")).toBe(false);
  });
});

describe("wantsMoreDishes", () => {
  it("nhan yeu cau mon khac", () => {
    expect(wantsMoreDishes("mon khac")).toBe(true);
    expect(wantsMoreDishes("goi y them mon di")).toBe(true);
  });

  it("khong nham voi cau hoi mon cu the", () => {
    expect(wantsMoreDishes("goi y mon chay")).toBe(false);
  });
});

describe("refersToLastPicks", () => {
  it("nhan dai tu tham chieu mon vua goi y", () => {
    expect(refersToLastPicks("mon do co cay khong")).toBe(true);
    expect(refersToLastPicks("may mon tren gia bao nhieu")).toBe(true);
  });

  it("cau mo chu de moi khong tinh la tham chieu", () => {
    expect(refersToLastPicks("goi y mon cho 2 nguoi")).toBe(false);
  });
});
