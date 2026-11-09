package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Mot doan van ban cua tai lieu sau khi chia nho, kem vector embedding de tim theo ngu nghia.
 * Embedding luu dang vector literal "[0.1,0.2,...]" de Postgres pgvector dung duoc;
 * khi DB chua co extension thi code tra ve lop Java van dung duoc.
 */
@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ChatbotKnowledgeChunk {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long documentId;

    private Integer chunkIndex;

    @Column(length = 4000)
    private String content;

    @Column(columnDefinition = "vector(768)")
    private String embedding;

    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();

    public ChatbotKnowledgeChunk(Long documentId, Integer chunkIndex, String content, String embedding) {
        this.documentId = documentId;
        this.chunkIndex = chunkIndex;
        this.content = content;
        this.embedding = embedding;
    }
}
