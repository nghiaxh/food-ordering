// Tra cứu tài liệu quán (RAG mức cơ bản, PostgreSQL tsvector + GIN).
// Không embedding: tìm bằng websearch_to_tsquery trên cột search_vector đã tạo sẵn
// (migration init), rồi fallback chấm từ khóa khi không có hit hoặc lỗi.

import { prisma } from "../../lib/prisma.js";
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
}

/**
 * Tìm chunk theo tsvector; không có hit thì trả rỗng để service rơi sang chấm từ khóa.
 * `websearch_to_tsquery('simple', $1)` khớp cụm từ như khách tự gõ, không cần cú pháp tsquery.
 */
export async function searchChunks(question: string, topK: number): Promise<ScoredChunk[]> {
  if (!question.trim()) return [];
  const rows = await prisma.$queryRaw<ChunkRow[]>`
    SELECT id, document_id, chunk_index, content,
           ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${question})) AS rank
    FROM chatbot_knowledge_chunk
    WHERE search_vector @@ websearch_to_tsquery('simple', ${question})
      AND document_id IN (SELECT id FROM chatbot_knowledge WHERE enabled = true)
    ORDER BY rank DESC
    LIMIT ${topK * 3}
  `.catch(() => [] as ChunkRow[]);

  if (rows.length === 0) return [];

  const docIds = [...new Set(rows.map((r) => r.document_id))];
  const docs = await prisma.chatbotKnowledge.findMany({ where: { id: { in: docIds } } });
  const docMap = new Map(docs.map((d) => [d.id, d]));

  return rows
    .map((r) => ({
      chunk: { id: r.id, documentId: r.document_id, chunkIndex: r.chunk_index, content: r.content },
      document: (() => {
        const d = docMap.get(r.document_id);
        return d ? { id: d.id, title: d.title, category: d.category } : null;
      })(),
      score: r.rank,
    }))
    .filter((s) => s.document !== null)
    .slice(0, topK);
}

/**
 * Chấm điểm tài liệu bằng từ khóa; dùng khi tsvector không có hit hoặc lỗi.
 * Khớp cụm từ khóa (ví dụ "giờ mở cửa") được cộng thêm điểm. Bỏ qua từ dừng và từ quá ngắn.
 */
export const keywordSearchKnowledge = async (
  question: string,
  topK = 3,
): Promise<Array<{ id: number; title: string | null; content: string | null }>> => {
  const words = significantWords(question);
  if (words.length === 0) return [];
  const docs = await prisma.chatbotKnowledge.findMany({ where: { enabled: true } }).catch(() => []);
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
