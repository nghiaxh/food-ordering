// Nạp tài liệu quán vào kho của chatbot: lưu file, tách text, chia đoạn, lưu chunk.
// Không embedding — chunk được tìm bằng tsvector (migration init có cột search_vector GENERATED).
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

/** Nạp tài liệu từ văn bản nhập trên giao diện (tab Tài liệu). */
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

/** Nạp tài liệu từ file admin tải lên (PDF/DOCX/TXT/MD, ≤ 10 MB — giới hạn ở route). */
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

  // Lưu file gốc để reingest sau này không phải tải lên lại.
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

/** Tạo lại chunk từ nội dung hiện tại (khi sửa bằng chữ). */
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

/** Cập nhật thông tin tài liệu và nạp lại (reingest) trong cùng thao tác. */
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
  // Nội dung có thể đã đổi nên phải chia đoạn lại; chi phí nhỏ với tài liệu < 10 MB.
  return reingestDocument(documentId);
};

export const deleteDocument = async (documentId: number) => {
  await db.delete(chatbotKnowledgeChunk).where(eq(chatbotKnowledgeChunk.documentId, documentId));
  const doc = await db.query.chatbotKnowledge.findFirst({ where: eq(chatbotKnowledge.id, documentId) });
  if (doc?.fileName) {
    try {
      unlinkSync(storedFilePath(documentId, doc.fileName));
    } catch {
      // File gốc không còn thì bỏ qua — chunks và bản ghi đã xoá là đủ.
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

/** Hash nội dung — dành cho báo cáo/đối soát nếu cần; hiện chưa hiển thị trên UI. */
export const contentHash = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);
