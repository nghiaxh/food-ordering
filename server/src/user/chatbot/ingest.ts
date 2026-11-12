import { createHash } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asc, count, eq } from "drizzle-orm";
import { chatbotKnowledge, chatbotKnowledgeChunk } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { env } from "../../config/env.js";
import { chunkText, parseDocument } from "./documentParser.js";

const uploadDir = () => env.UPLOAD_DIR;

mkdirSync(uploadDir(), { recursive: true });

// Nap tai lieu quan vao kho cua chatbot: luu file, tach text, chia doan, luu chunk.
// Khong embedding - chunk duoc tim bang tsvector (migration init co cot search_vector GENERATED).
export interface KnowledgeDocJson {
  id: number;
  title: string | null;
  category: string | null;
  keywords: string | null;
  content: string | null;
  enabled: boolean;
  status: string;
  fileName: string | null;
  fileSize: number | null;
  chunkCount: number;
}

const toDoc = async (d: {
  id: number;
  title: string | null;
  category: string | null;
  keywords: string | null;
  content: string | null;
  enabled: boolean;
  status: string;
  fileName: string | null;
  fileSize: number | null;
}): Promise<KnowledgeDocJson> => {
  const rows = await db
    .select({ value: count() })
    .from(chatbotKnowledgeChunk)
    .where(eq(chatbotKnowledgeChunk.documentId, d.id));
  const chunkCount = rows[0]?.value ?? 0;
  return { ...d, chunkCount };
};

const truncate = (s: string, max: number): string => {
  const t = s.replaceAll(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max);
};

const safeName = (id: number, original: string | null): string => {
  const name = (original ?? "doc").replaceAll(/[^a-zA-Z0-9._-]/g, "_");
  return `${id}_${name}`;
};

const storedFilePath = (id: number, fileName: string | null): string =>
  join(uploadDir(), safeName(id, fileName));

const buildChunks = async (documentId: number, text: string) => {
  await db.delete(chatbotKnowledgeChunk).where(eq(chatbotKnowledgeChunk.documentId, documentId));
  const chunks = chunkText(text);
  if (chunks.length > 0) {
    await db.insert(chatbotKnowledgeChunk).values(
      chunks.map((content, chunkIndex) => ({ documentId, chunkIndex, content })),
    );
  }
};

/** Nap tai lieu tu van ban nhap tren giao dien (tab Tai lieu). */
export const ingestText = async (
  title: string | null,
  category: string | null,
  keywords: string | null,
  content: string,
  enabled: boolean,
): Promise<KnowledgeDocJson> => {
  const [doc] = await db
    .insert(chatbotKnowledge)
    .values({ title, category, keywords, content, enabled, status: "READY" })
    .returning();
  await buildChunks(doc!.id, content);
  return toDoc(doc!);
};

/** Nap tai lieu tu file admin tai len (PDF/DOCX/TXT/MD, <= 10 MB - gioi han o route). */
export const ingestFile = async (
  fileName: string,
  buffer: Buffer,
  title: string | null,
  category: string | null,
  keywords: string | null,
): Promise<KnowledgeDocJson> => {
  const [doc] = await db
    .insert(chatbotKnowledge)
    .values({
      title: title ?? fileName,
      category,
      keywords,
      content: "",
      enabled: true,
      status: "PENDING",
      fileName,
      fileSize: buffer.length,
    })
    .returning();

  // Luu file goc de reingest sau nay khong phai tai len lai.
  writeFileSync(storedFilePath(doc!.id, fileName), buffer);

  let text = "";
  try {
    text = await parseDocument(fileName, buffer);
  } catch {
    await db
      .update(chatbotKnowledge)
      .set({ status: "FAILED" })
      .where(eq(chatbotKnowledge.id, doc!.id));
    throw new Error("Không đọc được nội dung file. Chỉ chấp nhận PDF, DOCX, TXT, MD.");
  }

  await db
    .update(chatbotKnowledge)
    .set({ content: truncate(text, 4000), status: "READY" })
    .where(eq(chatbotKnowledge.id, doc!.id));
  await buildChunks(doc!.id, text);
  return toDoc({ ...doc!, content: truncate(text, 4000), status: "READY" });
};

/** Tao lai chunk tu noi dung hien tai (khi sua bang chu). */
export const reingestDocument = async (documentId: number): Promise<KnowledgeDocJson> => {
  const doc = await db.query.chatbotKnowledge.findFirst({ where: eq(chatbotKnowledge.id, documentId) });
  if (!doc) throw new Error("Không tìm thấy tài liệu");

  let text = doc.content ?? "";
  if (!text.trim() && doc.fileName) {
    try {
      const { readFileSync } = await import("node:fs");
      const buffer = readFileSync(storedFilePath(documentId, doc.fileName));
      text = await parseDocument(doc.fileName, buffer);
      await db
        .update(chatbotKnowledge)
        .set({ content: truncate(text, 4000) })
        .where(eq(chatbotKnowledge.id, documentId));
    } catch {
      await db
        .update(chatbotKnowledge)
        .set({ status: "FAILED" })
        .where(eq(chatbotKnowledge.id, documentId));
      throw new Error("Không đọc lại được file của tài liệu này.");
    }
  }

  if (!text.trim()) {
    await db
      .update(chatbotKnowledge)
      .set({ status: "FAILED" })
      .where(eq(chatbotKnowledge.id, documentId));
    throw new Error("Tài liệu rỗng, không nạp được.");
  }

  await buildChunks(documentId, text);
  const [updated] = await db
    .update(chatbotKnowledge)
    .set({ status: "READY" })
    .where(eq(chatbotKnowledge.id, documentId))
    .returning();
  return toDoc(updated!);
};

/** Cap nhat thong tin tai lieu va nap lai (reingest) trong cung thao tac. */
export const updateDocument = async (
  documentId: number,
  patch: { title: string | null; category: string | null; keywords: string | null; content: string; enabled: boolean },
): Promise<KnowledgeDocJson> => {
  const doc = await db.query.chatbotKnowledge.findFirst({
    where: eq(chatbotKnowledge.id, documentId),
    columns: { id: true },
  });
  if (!doc) throw new Error("Không tìm thấy tài liệu");
  await db
    .update(chatbotKnowledge)
    .set({
      title: patch.title,
      category: patch.category,
      keywords: patch.keywords,
      content: patch.content,
      enabled: patch.enabled,
    })
    .where(eq(chatbotKnowledge.id, documentId));
  // Noi dung co the da doi nen phai chia doan lai; chi phi nho voi tai lieu < 10 MB.
  return reingestDocument(documentId);
};

export const deleteDocument = async (documentId: number) => {
  await db.delete(chatbotKnowledgeChunk).where(eq(chatbotKnowledgeChunk.documentId, documentId));
  const doc = await db.query.chatbotKnowledge.findFirst({ where: eq(chatbotKnowledge.id, documentId) });
  if (doc?.fileName) {
    try {
      unlinkSync(storedFilePath(documentId, doc.fileName));
    } catch {
      // File goc khong con thi bo qua - chunks va ban ghi da xoa la du.
    }
  }
  await db.delete(chatbotKnowledge).where(eq(chatbotKnowledge.id, documentId));
};

export const listDocuments = async (): Promise<KnowledgeDocJson[]> => {
  const docs = await db.query.chatbotKnowledge.findMany({ orderBy: [asc(chatbotKnowledge.id)] });
  return Promise.all(docs.map(toDoc));
};

export const documentStats = async () => {
  const docs = await db.query.chatbotKnowledge.findMany({ columns: { status: true } });
  const chunkRows = await db.select({ value: count() }).from(chatbotKnowledgeChunk);
  const totalChunks = chunkRows[0]?.value ?? 0;
  const ready = docs.filter((d) => d.status === "READY").length;
  const failed = docs.filter((d) => d.status === "FAILED").length;
  return { totalDocuments: docs.length, totalChunks, ready, failed };
};

export const listChunks = async (documentId: number) => {
  const rows = await db.query.chatbotKnowledgeChunk.findMany({
    where: eq(chatbotKnowledgeChunk.documentId, documentId),
    orderBy: [asc(chatbotKnowledgeChunk.chunkIndex)],
  });
  return rows.map((r) => ({ id: r.id, chunkIndex: r.chunkIndex ?? 0, content: r.content }));
};

/** Hash noi dung - danh cho bao cao/doi soat neu can; hien chua hien thi tren UI. */
export const contentHash = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);
