package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Tai lieu tra cuu cua quan (gio mo cua, giao hang, thanh toan...) de chatbot tra loi
 * co nguon. Noi dung do admin nhap, khong phai AI tu viet.
 */
@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ChatbotKnowledge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    private String category;

    private String keywords;

    @Column(length = 4000)
    private String content;

    private boolean enabled = true;

    /** Ten file goc khi tai len (null khi nhap bang chu), de reingest sau nay. */
    private String fileName;

    private Long fileSize;

    /** PENDING | READY | FAILED - trang thai ingest/chia doan. */
    private String status = "READY";

    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();

    private java.time.LocalDateTime updatedAt = java.time.LocalDateTime.now();

    public ChatbotKnowledge(String title, String category, String keywords, String content, boolean enabled) {
        this.title = title;
        this.category = category;
        this.keywords = keywords;
        this.content = content;
        this.enabled = enabled;
    }
}
