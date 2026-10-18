package com.foodordering.repository;

import com.foodordering.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    long countByUserId(Long userId);
    void deleteByUserId(Long userId);
    List<ChatMessage> findTop10BySessionIdOrderByCreatedAtDesc(String sessionId);
    List<ChatMessage> findAllByOrderByCreatedAtDesc();
}