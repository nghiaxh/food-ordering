package com.foodordering.controller;

import com.foodordering.dto.ChatbotDtos.*;
import com.foodordering.service.ChatbotService;
import jakarta.validation.Valid;
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
        String email = auth.getName().equals("anonymousUser") ? null : auth.getName();
        return chatbotService.chat(email, req);
    }
}