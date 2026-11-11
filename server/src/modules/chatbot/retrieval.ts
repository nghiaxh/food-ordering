// Tra cuu tai lieu quan (RAG muc co ban, PostgreSQL tsvector + GIN).
// Khong embedding: tim bang websearch_to_tsquery tren cot search_vector da tao san
// (migration init), roi fallback cham tu khoa khi khong co hit hoac loi.

import { eq, inArray, sql } from "drizzle-orm";
import { chatbotKnowledge } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { plain } from "../../lib/text-normalizer.js";
import { significantWords } from "./filters.js";

export interface ScoredChunk {
  chunk: { id: number; documentId: number; chunkIndex: number; content: string };
  document: { id: number; title: string | null; category: string | null } | null;
  score: number;
}

interface ChunkRow {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  rank: number;
  [key: string]: unknown;
}

/**
 * Tim chunk theo tsvector; khong co hit thi tra rong de service roi sang cham tu khoa.
 * `websearch_to_tsquery('simple', $1)` khop cum tu nhu khach tu go, khong can cu phap tsquery.
 */
export async function searchChunks(question: string, topK: number): Promise<ScoredChunk[]> {
  if (!question.trim()) return [];
  const limit = topK * 3;
  const result = await db
    .execute<ChunkRow>(sql`
      SELECT id, document_id, chunk_index, content,
             ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${question})) AS rank
      FROM chatbot_knowledge_chunk
      WHERE search_vector @@ websearch_to_tsquery('simple', ${question})
        AND document_id IN (SELECT id FROM chatbot_knowledge WHERE enabled = true)
      ORDER BY rank DESC
      LIMIT ${limit}
    `)
    .catch(() => ({ rows: [] as ChunkRow[] }));

  const rows = result.rows;
  if (!rows || rows.length === 0) return [];

  const docIds = [...new Set(rows.map((r) => r.document_id))];
  const docs = await db.query.chatbotKnowledge.findMany({
    where: inArray(chatbotKnowledge.id, docIds),
  });
  const docMap = new Map(docs.map((d) => [d.id, d]));

  return rows
    .map((r) => ({
      chunk: { id: r.id, documentId: r.document_id, chunkIndex: r.chunk_index, content: r.content },
      document: (() => {
        const d = docMap.get(r.document_id);
        return d ? { id: d.id, title: d.title, category: d.category } : null;
      })(),
      score: Number(r.rank),
    }))
    .filter((s) => s.document !== null)
    .slice(0, topK);
}

/**
 * Cham diem tai lieu bang tu khoa; dung khi tsvector khong co hit hoac loi.
 * Khop cum tu khoa (vi du "gio mo cua") duoc cong them diem. Bo qua tu dung va tu qua ngan.
 */
export const keywordSearchKnowledge = async (
  question: string,
  topK = 3,
): Promise<Array<{ id: number; title: string | null; content: string | null }>> => {
  const words = significantWords(question);
  if (words.length === 0) return [];
  const docs = await db.query.chatbotKnowledge.findMany({
    where: eq(chatbotKnowledge.enabled, true),
  }).catch(() => []);
  const q = plain(question);

  const scored = docs
    .map((d) => {
      const hay = plain(
        [d.title, d.category, d.keywords, d.content].filter(Boolean).join(" "),
      );
      let score = 0;
      for (const w of words) if (hay.includes(w)) score++;
      if (d.keywords) {
        for (const kw of d.keywords.split(",")) {
          const k = plain(kw.trim());
          if (k && q.includes(k)) score += 2;
        }
      }
      return { doc: d, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((s) => ({ id: s.doc.id, title: s.doc.title, content: s.doc.content }));
};
