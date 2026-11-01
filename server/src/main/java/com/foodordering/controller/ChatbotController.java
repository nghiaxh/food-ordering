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

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
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
}