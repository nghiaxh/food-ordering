package com.foodordering.service;

import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.entity.ChatbotKnowledgeChunk;
import com.foodordering.repository.ChatbotKnowledgeChunkRepository;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class KnowledgeRagTest {

    @Test
    void parserChiaDoan() {
        DocumentParserService p = new DocumentParserService();
        String longText = "a ".repeat(700);
        List<String> chunks = p.chunk(longText);
        assertThat(chunks).isNotEmpty();
        assertThat(chunks.get(0).length()).isLessThanOrEqualTo(600);
    }

    @Test
    void embeddingVectorLiteralRoundTrip() {
        float[] v = new float[]{0.1f, 0.2f, 0.3f};
        String lit = AiClient.toVectorLiteral(v);
        assertThat(lit).isEqualTo("[0.1,0.2,0.3]");
        float[] back = AiClient.parseVectorLiteral(lit);
        assertThat(back).containsExactly(0.1f, 0.2f, 0.3f);
        assertThat(AiClient.cosine(v, back)).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-5));
    }

    @Test
    void vectorSearchFallbackKhiKhongCoExtension() {
        AiClient ai = mock(AiClient.class);
        when(ai.embed(anyString())).thenReturn(new float[]{1f, 0f});
        ChatbotKnowledgeChunkRepository chunkRepo = mock(ChatbotKnowledgeChunkRepository.class);
        ChatbotKnowledgeRepository docRepo = mock(ChatbotKnowledgeRepository.class);
        ChatbotKnowledge doc = new ChatbotKnowledge("Gio mo cua", "HOURS", "mo cua", "Mo tu 07:00", true);
        doc.setId(1L);
        when(docRepo.findById(1L)).thenReturn(java.util.Optional.of(doc));
        // Native query loi (DB chua co vector) thi tra rong, fallback lay all.
        when(chunkRepo.findByVectorSimilarity(anyString(), anyInt())).thenThrow(new RuntimeException("vector missing"));
        when(chunkRepo.findByEmbeddingIsNotNull()).thenReturn(List.of(
                new ChatbotKnowledgeChunk(1L, 0, "Mo tu 07:00 den 22:00", "[1.0,0.0]"),
                new ChatbotKnowledgeChunk(1L, 1, "Giao hang 30 phut", "[0.0,1.0]")
        ));
        VectorSearchService s = new VectorSearchService(chunkRepo, docRepo, ai);
        var hits = s.search("mo cua may gio", 1);
        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).document().getId()).isEqualTo(1L);
    }

    @Test
    void ingestionTaoChunkKhiNhapChu() throws Exception {
        AiClient ai = mock(AiClient.class);
        when(ai.embed(anyString())).thenReturn(new float[]{0.5f, 0.5f});
        ChatbotKnowledgeRepository docRepo = mock(ChatbotKnowledgeRepository.class);
        ChatbotKnowledgeChunkRepository chunkRepo = mock(ChatbotKnowledgeChunkRepository.class);
        DocumentParserService parser = new DocumentParserService();
        KnowledgeIngestionService svc = new KnowledgeIngestionService(docRepo, chunkRepo, parser, ai, "uploads");
        ChatbotKnowledge saved = new ChatbotKnowledge("Tieu de", "CAT", "kw", "Noi dung tai lieu", true);
        saved.setId(99L);
        when(docRepo.save(any(ChatbotKnowledge.class))).thenAnswer(inv -> {
            ChatbotKnowledge a = inv.getArgument(0);
            if (a.getId() == null) a.setId(99L);
            return a;
        });
        when(docRepo.findById(anyLong())).thenReturn(java.util.Optional.of(saved));
        svc.ingestText("Tieu de", "CAT", "kw", "Noi dung tai lieu", true);
        verify(chunkRepo, atLeastOnce()).save(any(ChatbotKnowledgeChunk.class));
    }
}
