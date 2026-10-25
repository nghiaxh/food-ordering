package com.foodordering.controller;

import com.foodordering.dto.FoodDtos.FoodRequest;
import com.foodordering.dto.OrderDtos.UpdateStatusRequest;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.foodordering.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final FoodService foodService;
    private final OrderService orderService;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;
    private final ChatMessageRepository chatRepo;
    private final AiSettingRepository settingRepo;

    public AdminController(FoodService foodService, OrderService orderService,
                           CategoryRepository categoryRepo, UserRepository userRepo,
                           ChatMessageRepository chatRepo, AiSettingRepository settingRepo) {
        this.foodService = foodService;
        this.orderService = orderService;
        this.categoryRepo = categoryRepo;
        this.userRepo = userRepo;
        this.chatRepo = chatRepo;
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

    @PatchMapping("/orders/{id}/payment")
    public Orders updatePayment(@PathVariable Long id, @RequestParam boolean paid) {
        return orderService.updatePayment(id, paid);
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

    // ----- Chatbot: cấu hình -----
    @GetMapping("/chatbot/settings")
    public List<AiSetting> settings() { return settingRepo.findAll(); }

    @PutMapping("/chatbot/settings")
    public AiSetting saveSetting(@RequestBody AiSetting s) { return settingRepo.save(s); }
}
