package com.foodordering.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class CartDtos {
    public record AddItemRequest(@NotNull Long foodId, @Min(1) int quantity) {}

    public record UpdateQuantityRequest(@Min(1) int quantity) {}
}
