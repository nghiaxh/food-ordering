// Tách text từ file admin tải lên: TXT/MD đọc thẳng UTF-8, PDF bằng pdf-parse,
// DOCX bằng mammoth. Chỉ nhận file không vượt 10 MB (kiểm ở route upload).
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const parseDocument = async (fileName: string, buffer: Buffer): Promise<string> => {
  const name = fileName.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    return buffer.toString("utf8");
  }
  if (name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error("Chỉ chấp nhận PDF, DOCX, TXT, MD");
};

/** Chia văn bản thành các đoạn ~600 ký tự, overlap ~80 ký tự để không vỡ ý. */
export const chunkText = (text: string): string[] => {
  if (!text?.trim()) return [];
  const t = text.replaceAll(/\s+/g, " ").trim();
  const SIZE = 600;
  const STEP = 520;
  const out: string[] = [];
  for (let i = 0; i < t.length; i += STEP) {
    const end = Math.min(t.length, i + SIZE);
    const piece = t.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end === t.length) break;
  }
  return out;
};
