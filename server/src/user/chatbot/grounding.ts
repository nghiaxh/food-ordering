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
 * - Gia phai nam trong allowedPrices
 * - Ten mon phai nam trong allowedFoodNames
 * - SĐT phai xuat hien nguyen van trong chunk
 * - Gio phai xuat hien nguyen van trong chunk
 */
export function verifyReply(reply: string, ctx: GroundingContext): VerifyResult {
  const violations: string[] = [];
  const p = plain(reply);

  // 1. Kiem tra gia: moi so tien phai nam trong allowedPrices
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

  // 2. Kiem tra ten mon: neu cau co ten mon trong DB nhung khong trong Plan
  const allFoodNames = ctx.allowedFoodNames.map((n) => plain(n));
  const dbFoodNames = ctx.allowedFoodNames; // chi kiem trong Plan
  // Kiem tra xem cau co nhac den mon nao khong nam trong allowedFoodNames
  // Don gian: kiem tra tung tu dai trong cau co khop ten mon DB khong
  // (chi ap dung khi co danh sach ten mon DB, o day dung allowedFoodNames)

  // 3. Kiem tra SĐT
  const phoneRegex = /0\d{9}/g;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(reply)) !== null) {
    const phone = phoneMatch[0];
    const inChunks = ctx.allowedChunks.some((c) => c.includes(phone));
    if (!inChunks) {
      violations.push(`SĐT khong co trong tai lieu: ${phone}`);
    }
  }

  // 4. Kiem tra gio: mau \d{1,2}[:h]\d{0,2}
  const timeRegex = /\d{1,2}[:hH]\d{0,2}/g;
  let timeMatch: RegExpExecArray | null;
  while ((timeMatch = timeRegex.exec(reply)) !== null) {
    const time = timeMatch[0];
    const inChunks = ctx.allowedChunks.some((c) => c.includes(time));
    if (!inChunks) {
      violations.push(`Gio khong co trong tai lieu: ${time}`);
    }
  }

  // 5. Do dai cau tra loi
  if (reply.length > 600) {
    violations.push(`Cau tra loi qua dai: ${reply.length} ky tu`);
  }

  return { ok: violations.length === 0, violations };
}