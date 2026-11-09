package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Phan hoi cua khach tren tin bot: up cho hai long, down cho can cai thien. */
@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ChatFeedback {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionId;

    private Integer messageIndex;

    private String rating;

    private LocalDateTime createdAt = LocalDateTime.now();
}
