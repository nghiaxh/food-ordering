package com.foodordering.repository;

import com.foodordering.entity.ChatbotKnowledge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatbotKnowledgeRepository extends JpaRepository<ChatbotKnowledge, Long> {
    List<ChatbotKnowledge> findByEnabledTrue();
}
