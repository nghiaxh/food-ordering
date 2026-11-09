package com.foodordering.service;

import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.entity.ChatbotKnowledgeChunk;
import com.foodordering.repository.ChatbotKnowledgeChunkRepository;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import org.springframework.stereotype.Service;

import java.util.*;

/** Tim chunk gan nhat theo ngu nghia: uu tien pgvector truoc, hong thi danh gia cosine trong Java. */
@Service
public class VectorSearchService {
    private final ChatbotKnowledgeChunkRepository chunkRepo;
    private final ChatbotKnowledgeRepository docRepo;
    private final AiClient ai;

    public VectorSearchService(ChatbotKnowledgeChunkRepository chunkRepo,
                               ChatbotKnowledgeRepository docRepo,
                               AiClient ai) {
        this.chunkRepo = chunkRepo;
        this.docRepo = docRepo;
        this.ai = ai;
    }

    /** Tra ve topK chunk kem tai lieu, sap theo similarity giam dan. */
    public List<ScoredChunk> search(String question, int topK) {
        if (question == null || question.isBlank()) return List.of();
        float[] q = ai.embed(question);
        if (q.length == 0) return List.of();

        List<ChatbotKnowledgeChunk> candidates;
        try {
            candidates = chunkRepo.findByVectorSimilarity(AiClient.toVectorLiteral(q), topK * 3);
        } catch (Exception e) {
            candidates = List.of();
        }
        if (candidates == null || candidates.isEmpty()) {
            // Fallback Java: diem cosine tren tap chunk nho (<10k) la du nhanh.
            candidates = chunkRepo.findByEmbeddingIsNotNull();
        }
        // Cham lai bang Java de co diem ro rang va loc nguong.
        List<ScoredChunk> scored = new ArrayList<>();
        Map<Long, ChatbotKnowledge> docMap = new HashMap<>();
        for (ChatbotKnowledgeChunk c : candidates) {
            float[] v = AiClient.parseVectorLiteral(c.getEmbedding());
            double s = AiClient.cosine(q, v);
            if (s < 0.25) continue;
            ChatbotKnowledge d = docMap.computeIfAbsent(c.getDocumentId(), id -> docRepo.findById(id).orElse(null));
            if (d == null || !d.isEnabled()) continue;
            scored.add(new ScoredChunk(c, d, s));
        }
        scored.sort(Comparator.comparingDouble(ScoredChunk::similarity).reversed());
        return scored.stream().limit(topK).toList();
    }

    public record ScoredChunk(ChatbotKnowledgeChunk chunk, ChatbotKnowledge document, double similarity) {}
}
