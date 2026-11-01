package com.foodordering.dto;

import com.foodordering.entity.Promotion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public class PromotionDtos {
    /** Khuyến mãi tự động: không cần mã, server chọn chương trình tốt nhất cho từng dòng món. */
    public record PromotionRequest(
            @NotBlank String name,
            String description,
            @NotNull Promotion.DiscountType discountType,
            @NotNull @Positive BigDecimal discountValue,
            BigDecimal maxDiscount,
            @NotNull Promotion.Scope scope,
            List<Long> targetIds,
            @NotNull LocalDateTime startsAt,
            @NotNull LocalDateTime endsAt,
            String daysOfWeek,
            LocalTime startTime,
            LocalTime endTime,
            boolean active,
            int priority,
            Integer usageLimit,
            int randomCount) {}
}
