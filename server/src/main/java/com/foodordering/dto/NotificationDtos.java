package com.foodordering.dto;

public class NotificationDtos {
    public record NotificationResponse(Long id, String content, boolean read, String createdAt) {}
}
