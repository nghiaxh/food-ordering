package com.foodordering.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.List;

public class ComboDtos {
    public record ComboItemRequest(@NotNull Long foodId, @Positive int quantity) {}
    public record ComboRequest(
            @NotBlank String name,
            String description,
            String imageUrl,
            @NotNull @Positive BigDecimal price,
            boolean available,
            List<ComboItemRequest> items) {}
}