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

    public ChatbotKnowledge(String title, String category, String keywords, String content, boolean enabled) {
        this.title = title;
        this.category = category;
        this.keywords = keywords;
        this.content = content;
        this.enabled = enabled;
    }
}
