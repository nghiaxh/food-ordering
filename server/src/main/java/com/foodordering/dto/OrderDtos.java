package com.foodordering.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import java.util.List;

public class OrderDtos {
    public record OrderItemRequest(@NotNull Long foodId, @Min(1) int quantity) {}

    public record CreateOrderRequest(
            @NotEmpty List<OrderItemRequest> items,
            @NotBlank String receiverName,
            @NotBlank String phone,
            @NotBlank String address,
            @NotBlank String paymentMethod) {}

    public record UpdateStatusRequest(@NotBlank String status) {}
}