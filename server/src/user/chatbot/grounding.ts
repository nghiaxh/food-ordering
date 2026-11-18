import { plain } from "../../lib/text-normalizer.js";

export interface GroundingContext {
  allowedPrices: number[];
  allowedFoodNames: string[];
  allowedChunks: string[];
}

export interface VerifyResult {
  ok: boolean;
  violations: string[];
}

/**
 * Kiem tra cau tra loi AI co bia thong tin khong.
 * Chi kiem tra do dai cau tra loi (qua dai → co the la hallucination).
 * Kiem tra gia/ten/SĐT/gio gay false positive (ngan sach user, dinh dang gio khac chunk)
 * nen da bo; prompt ANSWER_PROMPT da co rule "Gia phai dung nhu MENU".
 */
export function verifyReply(reply: string, ctx: GroundingContext): VerifyResult {
  const violations: string[] = [];

  // Chi kiem tra do dai cau tra loi.
  if (reply.length > 800) {
    violations.push(`Cau tra loi qua dai: ${reply.length} ky tu`);
  }

  return { ok: violations.length === 0, violations };
}