import { plain } from "../../lib/text-normalizer.js";

export interface VerifyResult {
  ok: boolean;
  violations: string[];
}

// Chu Thai, Trung, Nhat, Han, Nga, A Rap... Model nho thinh thoang doi ngon ngua giua cau.
// gap ky tu ngoai Latin + dau Viet la phai goi lai, khong duoc hien cho khach.
const FOREIGN_SCRIPT =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/;

export function hasForeignScript(reply: string): boolean {
  return FOREIGN_SCRIPT.test(reply);
}

/** Model nho hay ket thuc bang cau hoi du prompt cam; bo cau hoi o cuoi, giu lai cau tra loi. */
export function dropTrailingQuestion(reply: string): string {
  const parts = reply.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  while (parts.length > 1 && parts[parts.length - 1]!.endsWith("?")) parts.pop();
  return parts.join(" ");
}

/** Cat bot cau tra loi dai dong: toi da 4 cau, cau cuoi luon co dau ket cau. */
export function limitSentences(reply: string, max = 4): string {
  const parts = reply.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const kept = parts.slice(0, max).join(" ");
  return /[.!?]$/.test(kept) ? kept : `${kept}.`;
}

/** Chi kiem tra do dai cau tra loi. */
export function verifyReply(reply: string): VerifyResult {
  const violations: string[] = [];
  if (reply.length > 800) {
    violations.push(`Cau tra loi qua dai: ${reply.length} ky tu`);
  }
  return { ok: violations.length === 0, violations };
}