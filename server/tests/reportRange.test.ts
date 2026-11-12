import { describe, expect, it } from "vitest";
import { parseBusinessDate, parseBusinessRange } from "../src/lib/businessTime.js";

// Bao cao phuc vu khach Viet: "YYYY-MM-DD" la ngay lich VN, khong phai ngay UTC.
const statusOf = (fn: () => unknown): number | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as { status?: number }).status;
  }
};

describe("parseBusinessDate", () => {
  it("đọc ngày trần theo đầu/cuối ngày giờ Việt", () => {
    expect(parseBusinessDate("2026-11-12").toISOString()).toBe("2026-11-11T17:00:00.000Z");
    expect(parseBusinessDate("2026-11-12", true).toISOString()).toBe("2026-11-12T16:59:59.999Z");
  });

  it("giữ nguyên chuỗi ISO datetime", () => {
    expect(parseBusinessDate("2026-11-12T05:30:00.000Z").toISOString()).toBe("2026-11-12T05:30:00.000Z");
  });

  it("từ chối chuỗi sai bằng lỗi 400", () => {
    expect(() => parseBusinessDate("abc")).toThrowError(/Khoảng ngày không hợp lệ/);
    expect(() => parseBusinessDate("2026-02-31")).toThrowError(/Khoảng ngày không hợp lệ/);
    expect(statusOf(() => parseBusinessDate("abc"))).toBe(400);
  });
});

describe("parseBusinessRange", () => {
  it("từ chối khoảng ngày bị đảo", () => {
    expect(() => parseBusinessRange("2026-11-12", "2026-11-01")).toThrowError(/ngày bắt đầu/);
  });

  it("nhận khoảng ngày hợp lệ", () => {
    const range = parseBusinessRange("2026-11-01", "2026-11-12");
    expect(range.from.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-11-12T16:59:59.999Z");
  });

  it("mặc định lấy 30 ngày gần nhất", () => {
    const range = parseBusinessRange();
    expect(range.to.getTime() - range.from.getTime()).toBeGreaterThan(29 * 24 * 3600 * 1000);
  });
});
