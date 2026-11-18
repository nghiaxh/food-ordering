import { eq, inArray, sql } from "drizzle-orm";
import { chatbotKnowledge, chatbotKnowledgeChunk } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import * as provider from "../../lib/provider.js";

// Tra cuu tai lieu quan (RAG): pgvector + cosine similarity.
// Khong con tsvector. Khong co vector (khong co khoa AI) -> tra rong.
export interface ScoredChunk {
  chunk: { id: number; documentId: number; chunkIndex: number; content: string };
  document: { id: number; title: string | null; category: string | null } | null;
  score: number;
}

export async function searchChunks(question: string, topK: number): Promise<ScoredChunk[]> {
  if (!question.trim()) return [];
  if (!provider.isConfigured()) return [];

  const queryVector = await provider.embed(question);
  if (!queryVector) return [];

  const limit = topK * 5; // bu recall vi HNSW loc sau
  const result = await db
    .execute<{
      id: number;
      document_id: number;
      chunk_index: number;
      content: string;
      similarity: number;
    }>(sql`
      SELECT id, document_id, chunk_index, content,
             1 - (embedding <=> ${JSON.stringify(queryVector)}::vector) AS similarity
      FROM chatbot_knowledge_chunk
      WHERE embedding IS NOT NULL
        AND document_id IN (SELECT id FROM chatbot_knowledge WHERE enabled = true)
      ORDER BY embedding <=> ${JSON.stringify(queryVector)}::vector
      LIMIT ${limit}
    `)
    .catch(() => ({ rows: [] }));

  const rows = result.rows;
  if (!rows || rows.length === 0) return [];

  const docIds = [...new Set(rows.map((r) => r.document_id))];
  const docs = await db.query.chatbotKnowledge.findMany({
    where: inArray(chatbotKnowledge.id, docIds),
  });
  const docMap = new Map(docs.map((d) => [d.id, d]));

  const minSimilarity = 0.55;
  return rows
    .filter((r) => Number(r.similarity) >= minSimilarity)
    .map((r) => ({
      chunk: { id: r.id, documentId: r.document_id, chunkIndex: r.chunk_index, content: r.content },
      document: (() => {
        const d = docMap.get(r.document_id);
        return d ? { id: d.id, title: d.title, category: d.category } : null;
      })(),
      score: Number(r.similarity),
    }))
    .filter((s) => s.document !== null)
    .slice(0, topK);
}
