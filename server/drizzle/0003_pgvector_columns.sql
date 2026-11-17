-- Migration: add vector column and embedding metadata to chatbot_knowledge_chunk
ALTER TABLE "chatbot_knowledge_chunk" ADD COLUMN IF NOT EXISTS "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_chunk" ADD COLUMN IF NOT EXISTS "embedding_model" varchar(64);--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_chunk" ADD COLUMN IF NOT EXISTS "embedded_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatbot_knowledge_chunk_embedding_idx" ON "chatbot_knowledge_chunk" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);--> statement-breakpoint

-- Migration: add embedding_error column to chatbot_knowledge
ALTER TABLE "chatbot_knowledge" ADD COLUMN IF NOT EXISTS "embedding_error" varchar(255);--> statement-breakpoint