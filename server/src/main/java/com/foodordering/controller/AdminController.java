package com.foodordering.controller;

import com.foodordering.dto.FoodDtos.FoodRequest;
import com.foodordering.dto.OrderDtos.UpdateStatusRequest;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.foodordering.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final FoodService foodService;
    private final OrderService orderService;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;
    private final ChatMessageRepository chatRepo;
    private final KnowledgeDocumentRepository docRepo;
    private final KnowledgeService knowledgeService;
    private final AiSettingRepository settingRepo;

    public AdminController(FoodService foodService, OrderService orderService, CategoryRepository categoryRepo,
                           UserRepository userRepo, ChatMessageRepository chatRepo,
                           KnowledgeDocumentRepository docRepo, KnowledgeService knowledgeService,
                           AiSettingRepository settingRepo) {
        this.foodService = foodService;
        this.orderService = orderService;
        this.categoryRepo = categoryRepo;
        this.userRepo = userRepo;
        this.chatRepo = chatRepo;
        this.docRepo = docRepo;
        this.knowledgeService = knowledgeService;
        this.settingRepo = settingRepo;
    }

    // ----- Món ăn -----
    @PostMapping("/foods")
    public Food createFood(@Valid @RequestBody FoodRequest req) { return foodService.create(req); }

    @PutMapping("/foods/{id}")
    public Food updateFood(@PathVariable Long id, @Valid @RequestBody FoodRequest req) { return foodService.update(id, req); }

    @DeleteMapping("/foods/{id}")
    public void deleteFood(@PathVariable Long id) { foodService.delete(id); }

    // ----- Danh mục -----
    @PostMapping("/categories")
    public Category createCategory(@RequestBody Category c) { return categoryRepo.save(c); }

    @PutMapping("/categories/{id}")
    public Category updateCategory(@PathVariable Long id, @RequestBody Category c) {
        c.setId(id);
        return categoryRepo.save(c);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable Long id) { categoryRepo.deleteById(id); }

    // ----- Đơn hàng -----
    @GetMapping("/orders")
    public List<Orders> orders() { return orderService.all(); }

    @PatchMapping("/orders/{id}/status")
    public Orders updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest req) {
        return orderService.updateStatus(id, req.status());
    }

    // ----- Khách hàng -----
    @GetMapping("/users")
    public List<User> users() { return userRepo.findAll(); }

    @PatchMapping("/users/{id}/active")
    public User toggleActive(@PathVariable Long id, @RequestParam boolean active) {
        User u = userRepo.findById(id).orElseThrow();
        u.setActive(active);
        return userRepo.save(u);
    }

    // ----- Chatbot: lịch sử hội thoại -----
    @GetMapping("/chatbot/history")
    public List<ChatMessage> history() { return chatRepo.findAllByOrderByCreatedAtDesc(); }

    // ----- Chatbot: tài liệu tham khảo (RAG cơ bản) -----
    @GetMapping("/chatbot/documents")
    public List<KnowledgeDocument> documents() { return docRepo.findAll(); }

    @PostMapping("/chatbot/documents")
    public KnowledgeDocument upload(@RequestParam("file") MultipartFile file) throws Exception {
        return knowledgeService.upload(file);
    }

    @DeleteMapping("/chatbot/documents/{id}")
    public void deleteDocument(@PathVariable Long id) { docRepo.deleteById(id); }

    // ----- Chatbot: cấu hình -----
    @GetMapping("/chatbot/settings")
    public List<AiSetting> settings() { return settingRepo.findAll(); }

    @PutMapping("/chatbot/settings")
    public AiSetting saveSetting(@RequestBody AiSetting s) { return settingRepo.save(s); }
}