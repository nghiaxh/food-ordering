package com.foodordering.service;

import com.foodordering.entity.Promotion;
import com.foodordering.repository.PromotionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Truy vấn và hợp lệ hóa khuyến mãi tự động. Chỉ còn một dạng khuyến mãi: không cần mã,
 * tự áp thành một chương trình tốt nhất cho từng dòng món khi giỏ/đơn được định giá.
 */
@Service
public class PromotionService {
    private final PromotionRepository repo;

    public PromotionService(PromotionRepository repo) {
        this.repo = repo;
    }

    public List<Promotion> activePromotions(LocalDateTime now) {
        return repo.findByActiveTrue().stream().filter(p -> isValid(p, now)).toList();
    }

    public boolean isValid(Promotion p, LocalDateTime now) {
        if (!p.isActive()) return false;
        if (now.isBefore(p.getStartsAt()) || now.isAfter(p.getEndsAt())) return false;
        if (p.getDaysOfWeek() != null && !p.getDaysOfWeek().isBlank()) {
            String day = now.getDayOfWeek().name();
            boolean ok = false;
            for (String d : p.getDaysOfWeek().split(",")) {
                if (d.trim().equalsIgnoreCase(day)) { ok = true; break; }
            }
            if (!ok) return false;
        }
        if (p.getStartTime() != null && p.getEndTime() != null) {
            LocalTime t = now.toLocalTime();
            if (p.getStartTime().isBefore(p.getEndTime()) || p.getStartTime().equals(p.getEndTime())) {
                if (t.isBefore(p.getStartTime()) || t.isAfter(p.getEndTime())) return false;
            } else {
                // qua nửa đêm
                if (t.isBefore(p.getStartTime()) && t.isAfter(p.getEndTime())) return false;
            }
        }
        if (p.getUsageLimit() != null && p.getUsedCount() >= p.getUsageLimit()) return false;
        return true;
    }

    public BigDecimal discountAmount(BigDecimal basePrice, Promotion p) {
        BigDecimal amount;
        if (p.getDiscountType() == Promotion.DiscountType.PERCENT) {
            amount = basePrice.multiply(p.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else {
            amount = p.getDiscountValue();
        }
        if (p.getMaxDiscount() != null && amount.compareTo(p.getMaxDiscount()) > 0) {
            amount = p.getMaxDiscount();
        }
        if (amount.compareTo(basePrice) > 0) amount = basePrice;
        if (amount.compareTo(BigDecimal.ZERO) < 0) amount = BigDecimal.ZERO;
        return amount;
    }

    /**
     * Ghi nhận lượt dùng của các khuyến mãi tự động đã áp vào một đơn, trong cùng transaction
     * với việc tạo đơn để `usageLimit` chặn đúng số đơn thật dùng chương trình.
     */
    @Transactional
    public void markUsed(List<Promotion> applied) {
        for (Promotion p : applied) {
            if (p == null) continue;
            p.setUsedCount(p.getUsedCount() + 1);
            repo.save(p);
        }
    }
}
