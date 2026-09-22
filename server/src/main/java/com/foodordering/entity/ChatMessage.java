package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter @NoArgsConstructor
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private User user;

    private String sessionId;

    @Enumerated(EnumType.STRING)
    private Sender sender;

    @Column(length = 4000)
    private String content;

    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Sender { USER, BOT }
}