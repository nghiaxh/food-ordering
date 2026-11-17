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

export function verifyReply(reply: string, ctx: GroundingContext): VerifyResult {
  const violations: string[] = [];

  // 1. Kiem tra gia
  const priceRegex = /(\d+(?:[.,]\d+)?)\s*(k|nghìn|nghin|ngàn|ngan|triệu|trieu|đ|dong|vnd)/gi;
  let match: RegExpExecArray | null;
  while ((match = priceRegex.exec(reply)) !== null) {
    const numStr = (match[1] ?? "").replace(/[.,]/g, "");
    let value = Number(numStr);
    const unit = (match[2] ?? "").toLowerCase();
    if (unit === "k" || unit === "nghìn" || unit === "nghin" || unit === "ngàn" || unit === "ngan") {
      value = value * 1000;
    } else if (unit === "triệu" || unit === "trieu") {
      value = value * 1_000_000;
    }
    if (!ctx.allowedPrices.some((ap) => Math.abs(ap - value) < 1)) {
      violations.push(`Gia khong hop le: ${value}`);
    }
  }

  // 2. Kiem tra SĐT
  const phoneRegex = /0\d{9}/g;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(reply)) !== null) {
    const phone = phoneMatch[0];
    const inChunks = ctx.allowedChunks.some((c) => c.includes(phone));
    if (!inChunks) {
      violations.push(`SDT khong co trong tai lieu: ${phone}`);
    }
  }

  // 3. Kiem tra gio
  const timeRegex = /\d{1,2}[:hH]\d{0,2}/g;
  let timeMatch: RegExpExecArray | null;
  while ((timeMatch = timeRegex.exec(reply)) !== null) {
    const time = timeMatch[0];
    const inChunks = ctx.allowedChunks.some((c) => c.includes(time));
    if (!inChunks) {
      violations.push(`Gio khong co trong tai lieu: ${time}`);
    }
  }

  // 4. Do dai
  if (reply.length > 600) {
    violations.push(`Cau tra loi qua dai: ${reply.length} ky tu`);
  }

  return { ok: violations.length === 0, violations };
}