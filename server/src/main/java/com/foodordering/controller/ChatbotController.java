package com.foodordering.controller;

import com.foodordering.dto.ChatbotDtos.*;
import com.foodordering.service.ChatbotService;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {
    private final ChatbotService chatbotService;
    private final com.foodordering.repository.ChatFeedbackRepository feedbackRepo;

    public ChatbotController(ChatbotService chatbotService,
                             com.foodordering.repository.ChatFeedbackRepository feedbackRepo) {
        this.chatbotService = chatbotService;
        this.feedbackRepo = feedbackRepo;
    }

    /** Client gọi khi mở khung chat để biết có được dùng trợ lý hay chưa. */
    @GetMapping("/status")
    public ChatbotStatus status() {
        return chatbotService.status();
    }

    @PostMapping("/chat")
    public ChatResponse chat(Authentication auth, @Valid @RequestBody ChatRequest req) {
        // Endpoint cho phép khách vãng lai chat nên Authentication có thể null hoặc là token ẩn danh;
        // chỉ lấy email khi thực sự đã đăng nhập để quyết định có lưu lịch sử hội thoại hay không.
        boolean anonymous = auth == null
                || auth instanceof AnonymousAuthenticationToken
                || "anonymousUser".equals(auth.getName());
        return chatbotService.chat(anonymous ? null : auth.getName(), req);
    }

    /** Ghi phan hoi up/down tren tin bot, de admin xem tin nao can cai thien. */
    @PostMapping("/feedback")
    public void feedback(@RequestBody FeedbackRequest req) {
        com.foodordering.entity.ChatFeedback f = new com.foodordering.entity.ChatFeedback();
        f.setSessionId(req.sessionId());
        f.setMessageIndex(req.messageIndex());
        f.setRating(req.rating());
        f.setCreatedAt(java.time.LocalDateTime.now());
        feedbackRepo.save(f);
    }
}