package com.foodordering.repository;

import com.foodordering.entity.ChatbotKnowledgeChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ChatbotKnowledgeChunkRepository extends JpaRepository<ChatbotKnowledgeChunk, Long> {
    List<ChatbotKnowledgeChunk> findByDocumentIdOrderByChunkIndex(Long documentId);
    void deleteByDocumentId(Long documentId);
    long countByDocumentId(Long documentId);

    /** Tim theo cosine similarity bang pgvector; tra ve [chunk, distance] da sap xep. */
    @Query(value = "SELECT * FROM chatbot_knowledge_chunk WHERE embedding IS NOT NULL ORDER BY embedding <=> ?::vector LIMIT ?1", nativeQuery = true)
    List<ChatbotKnowledgeChunk> findByVectorSimilarity(String vectorLiteral, int limit);

    List<ChatbotKnowledgeChunk> findByEmbeddingIsNotNull();
}
