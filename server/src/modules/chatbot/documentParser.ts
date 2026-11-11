// Tach text tu file admin tai len: TXT/MD doc thang UTF-8, PDF bang pdf-parse,
// DOCX bang mammoth. Chi nhan file khong vuot 10 MB (kiem o route upload).
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

/** Chia van ban thanh cac doan ~600 ky tu, overlap ~80 ky tu de khong vo y. */
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
