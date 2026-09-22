package com.foodordering.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class FoodDtos {
    public record FoodRequest(
            @NotBlank String name,
            @NotNull Long categoryId,
            String description,
            String ingredients,
            @NotNull @Positive BigDecimal price,
            String imageUrl,
            int servingSize,
            int spicyLevel,
            String dietaryTags,
            String allergens,
            boolean available) {}
}