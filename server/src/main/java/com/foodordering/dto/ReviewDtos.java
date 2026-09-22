package com.foodordering.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ReviewDtos {
    public record ReviewRequest(@NotNull Long foodId, @Min(1) @Max(5) int rating, String comment) {}

    public record ReviewResponse(Long id, String userName, int rating, String comment, String createdAt) {}
}