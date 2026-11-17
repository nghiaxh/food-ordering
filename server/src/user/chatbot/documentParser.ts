import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Tach text tu file admin tai len: TXT/MD doc thang UTF-8, PDF bang pdf-parse,
// DOCX bang mammoth. Chi nhan file khong vuot 10 MB (kiem o route upload).
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

/** Chia van ban thanh cac doan ~600 ky tu, overlap 80 ky tu, khong cat giua tu, giu tieu de. */
export const chunkText = (text: string): string[] => {
  if (!text?.trim()) return [];
  // Chuan hoa: \r\n -> \n, gop 3+ dong trong thanh 2
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const SIZE = 600;
  const OVERLAP = 80;
  const MIN_CHUNK = 120;

  // Tach theo doan (danh sach dong trong)
  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  let currentHeading = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Tieu de: dong ngan, khong ket thuc bang dau cham
    const isHeading = trimmed.length < 80 && !/[.!?。]$/.test(trimmed);

    if (isHeading) {
      // Luu tieu de de gan vao chunk tiep theo
      currentHeading = trimmed;
      // Neu dang co chunk dang do, day ra
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      continue;
    }

    const piece = currentHeading ? `${currentHeading}\n${trimmed}` : trimmed;

    if (current && current.length + piece.length + 2 > SIZE) {
      // Day chunk hien tai ra, bat dau chunk moi voi overlap
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - OVERLAP));
      current = tail + "\n" + piece;
    } else {
      current = current ? current + "\n" + piece : piece;
    }
  }

  if (current.trim()) {
    // Chunk cuoi qua ngan thi gop vao chunk truoc
    if (current.trim().length < MIN_CHUNK && chunks.length > 0) {
      chunks[chunks.length - 1] = chunks[chunks.length - 1] + "\n" + current.trim();
    } else {
      chunks.push(current.trim());
    }
  }

  // Dam bao khong cat giua tu: cat tai khoang trang gan nhat
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= SIZE) {
      result.push(chunk);
    } else {
      // Cat tai khoang trang
      let pos = SIZE;
      while (pos > 0 && chunk[pos] !== " " && chunk[pos] !== "\n") pos--;
      if (pos === 0) pos = SIZE;
      result.push(chunk.slice(0, pos).trim());
      const rest = chunk.slice(pos).trim();
      if (rest) result.push(rest);
    }
  }

  return result.filter((c) => c.length > 0);
};
