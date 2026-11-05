package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User user;

    @Column(length = 1000)
    private String content;

    /** Đơn liên quan để client mở đúng đơn; null với thông báo cũ hoặc thông báo không gắn đơn. */
    private Long orderId;

    private boolean read = false;

    private LocalDateTime createdAt = LocalDateTime.now();
}
