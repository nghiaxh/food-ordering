package com.foodordering.controller;

import com.foodordering.dto.ChatbotDtos.KnowledgeDoc;
import com.foodordering.dto.ChatbotDtos.KnowledgeRequest;
import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/**
 * Quan ly tai lieu cua quan cho chatbot (tab Tai lieu). Chi admin duoc cham o
 * /api/admin/** nen endpoint nay khong can check them.
 */
@RestController
@RequestMapping("/api/admin/chatbot/documents")
public class AdminChatbotKnowledgeController {
    private final ChatbotKnowledgeRepository repo;

    public AdminChatbotKnowledgeController(ChatbotKnowledgeRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public java.util.List<KnowledgeDoc> list() {
        return repo.findAll().stream().map(this::toDoc).toList();
    }

    @PostMapping
    public KnowledgeDoc create(@Valid @RequestBody KnowledgeRequest req) {
        ChatbotKnowledge d = new ChatbotKnowledge(req.title(), req.category(), req.keywords(), req.content(), req.enabled());
        return toDoc(repo.save(d));
    }

    @PutMapping("/{id}")
    public KnowledgeDoc update(@PathVariable Long id, @Valid @RequestBody KnowledgeRequest req) {
        ChatbotKnowledge d = repo.findById(id).orElseThrow();
        d.setTitle(req.title());
        d.setCategory(req.category());
        d.setKeywords(req.keywords());
        d.setContent(req.content());
        d.setEnabled(req.enabled());
        return toDoc(repo.save(d));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repo.deleteById(id);
    }

    private KnowledgeDoc toDoc(ChatbotKnowledge d) {
        return new KnowledgeDoc(d.getId(), d.getTitle(), d.getCategory(), d.getKeywords(), d.getContent(), d.isEnabled());
    }
}
