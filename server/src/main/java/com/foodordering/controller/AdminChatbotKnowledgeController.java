package com.foodordering.controller;

import com.foodordering.dto.ChatbotDtos.ChunkView;
import com.foodordering.dto.ChatbotDtos.DocStats;
import com.foodordering.dto.ChatbotDtos.KnowledgeDoc;
import com.foodordering.dto.ChatbotDtos.KnowledgeRequest;
import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.repository.ChatbotKnowledgeChunkRepository;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import com.foodordering.service.KnowledgeIngestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Quan ly tai lieu cua quan cho chatbot (tab Tai lieu). Chi admin duoc cham o
 * /api/admin/** nen endpoint nay khong can check them.
 */
@RestController
@RequestMapping("/api/admin/chatbot/documents")
public class AdminChatbotKnowledgeController {
    private final ChatbotKnowledgeRepository repo;
    private final ChatbotKnowledgeChunkRepository chunkRepo;
    private final KnowledgeIngestionService ingestion;

    public AdminChatbotKnowledgeController(ChatbotKnowledgeRepository repo,
                                           ChatbotKnowledgeChunkRepository chunkRepo,
                                           KnowledgeIngestionService ingestion) {
        this.repo = repo;
        this.chunkRepo = chunkRepo;
        this.ingestion = ingestion;
    }

    @GetMapping
    public java.util.List<KnowledgeDoc> list() {
        return repo.findAll().stream().map(this::toDoc).toList();
    }

    @GetMapping("/stats")
    public DocStats stats() {
        java.util.List<ChatbotKnowledge> all = repo.findAll();
        long ready = all.stream().filter(d -> "READY".equals(d.getStatus())).count();
        long failed = all.stream().filter(d -> "FAILED".equals(d.getStatus())).count();
        long chunks = chunkRepo.count();
        return new DocStats(all.size(), chunks, ready, failed);
    }

    @GetMapping("/{id}/chunks")
    public java.util.List<ChunkView> chunks(@PathVariable Long id) {
        return chunkRepo.findByDocumentIdOrderByChunkIndex(id).stream()
                .map(c -> new ChunkView(c.getId(), c.getChunkIndex() == null ? 0 : c.getChunkIndex(), c.getContent()))
                .toList();
    }

    @PostMapping
    public KnowledgeDoc create(@Valid @RequestBody KnowledgeRequest req) {
        ChatbotKnowledge d = ingestion.ingestText(req.title(), req.category(), req.keywords(), req.content(), req.enabled());
        return toDoc(d);
    }

    @PutMapping("/{id}")
    public KnowledgeDoc update(@PathVariable Long id, @Valid @RequestBody KnowledgeRequest req) {
        ChatbotKnowledge d = repo.findById(id).orElseThrow();
        d.setTitle(req.title());
        d.setCategory(req.category());
        d.setKeywords(req.keywords());
        d.setContent(req.content());
        d.setEnabled(req.enabled());
        d = repo.save(d);
        try { ingestion.reingest(id); } catch (Exception ignored) {}
        return toDoc(repo.findById(id).orElseThrow());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        ingestion.delete(id);
    }

    @PostMapping("/upload")
    public KnowledgeDoc upload(@RequestParam("file") MultipartFile file,
                               @RequestParam(value = "title", required = false) String title,
                               @RequestParam(value = "category", required = false) String category,
                               @RequestParam(value = "keywords", required = false) String keywords) {
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp rỗng");
        if (file.getSize() > 10_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp tối đa 10 MB");
        String t = (title == null || title.isBlank()) ? file.getOriginalFilename() : title;
        try {
            ChatbotKnowledge d = ingestion.ingestFile(file, t, category, keywords);
            return toDoc(d);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không nạp được tài liệu");
        }
    }

    @PostMapping("/{id}/reingest")
    public KnowledgeDoc reingest(@PathVariable Long id) {
        try {
            ingestion.reingest(id);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Nạp lại thất bại");
        }
        return toDoc(repo.findById(id).orElseThrow());
    }

    private KnowledgeDoc toDoc(ChatbotKnowledge d) {
        long chunks = 0;
        try { chunks = chunkRepo.countByDocumentId(d.getId()); } catch (Exception ignored) {}
        return new KnowledgeDoc(d.getId(), d.getTitle(), d.getCategory(), d.getKeywords(), d.getContent(), d.isEnabled(),
                d.getStatus(), d.getFileName(), d.getFileSize(), chunks);
    }
}
