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
    public record PromotionRequest(
            @NotBlank String name,
            String description,
            @NotNull Promotion.DiscountType discountType,
            @NotNull @Positive BigDecimal discountValue,
            BigDecimal maxDiscount,
            BigDecimal minOrderTotal,
            @NotNull Promotion.Scope scope,
            List<Long> targetIds,
            String code,
            @NotNull LocalDateTime startsAt,
            @NotNull LocalDateTime endsAt,
            String daysOfWeek,
            LocalTime startTime,
            LocalTime endTime,
            boolean active,
            int priority,
            boolean stackable,
            Integer usageLimit,
            int randomCount,
            boolean claimable,
            String occasion) {}

    public record VoucherValidateRequest(String code, BigDecimal subtotal) {}

    /**
     * Voucher nhìn từ phía khách. Không trả entity Promotion trực tiếp vì khách không cần
     * biết usedCount, priority hay các trường cấu hình nội bộ của quán.
     */
    public record VoucherView(
            Long id,
            String code,
            String name,
            String description,
            String occasion,
            Promotion.DiscountType discountType,
            BigDecimal discountValue,
            BigDecimal maxDiscount,
            BigDecimal minOrderTotal,
            LocalDateTime endsAt,
            boolean claimed,
            boolean used) {}
}