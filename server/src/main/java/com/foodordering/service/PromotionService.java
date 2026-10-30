package com.foodordering.service;

import com.foodordering.dto.PromotionDtos.VoucherView;
import com.foodordering.entity.Promotion;
import com.foodordering.entity.User;
import com.foodordering.entity.UserVoucher;
import com.foodordering.repository.PromotionRepository;
import com.foodordering.repository.UserVoucherRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class PromotionService {
    private final PromotionRepository repo;
    private final UserVoucherRepository userVoucherRepo;

    public PromotionService(PromotionRepository repo, UserVoucherRepository userVoucherRepo) {
        this.repo = repo;
        this.userVoucherRepo = userVoucherRepo;
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

    public Promotion validateVoucher(String code, BigDecimal subtotal, LocalDateTime now) {
        if (code == null || code.isBlank()) return null;
        Promotion p = repo.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã khuyến mãi không tồn tại"));
        if (!isValid(p, now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã khuyến mãi đã hết hạn hoặc hết lượt dùng");
        }
        if (p.getCode() == null || p.getCode().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã khuyến mãi không hợp lệ");
        }
        requireMinOrderTotal(p, subtotal);
        return p;
    }

    /**
     * Ngưỡng đơn tối thiểu của mã, dùng chung cho hai lối kiểm tra: lúc validate mã (tính
     * trên subtotal) và lúc chia khoản giảm vào từng dòng (tính trên phần còn lại sau
     * khuyến mãi tự động). Hai chỗ này cố ý giữ riêng vì so trên hai mức tiền khác nhau.
     */
    public void requireMinOrderTotal(Promotion p, BigDecimal amount) {
        if (p.getMinOrderTotal() != null && amount.compareTo(p.getMinOrderTotal()) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã");
        }
    }

    public void incrementUsage(Promotion p) {
        if (p == null) return;
        p.setUsedCount(p.getUsedCount() + 1);
        repo.save(p);
    }

    // ----- Ví voucher của khách -----

    /** Voucher khách có thể nhận: đang mở, còn lượt, có mã để áp. */
    public List<VoucherView> claimable(User user, LocalDateTime now) {
        return repo.findByActiveTrue().stream()
                .filter(p -> p.isClaimable()
                        && p.getCode() != null && !p.getCode().isBlank()
                        && isValid(p, now))
                .map(p -> view(p, user == null ? null : userVoucherRepo
                        .findByUserIdAndPromotionId(user.getId(), p.getId()).orElse(null)))
                .toList();
    }

    /** Toàn bộ voucher khách đã nhận, kể cả đã dùng, để khách đối chiếu. */
    public List<VoucherView> mine(User user) {
        return userVoucherRepo.findByUserIdOrderByClaimedAtDesc(user.getId()).stream()
                .map(uv -> view(uv.getPromotion(), uv))
                .toList();
    }

    @Transactional
    public VoucherView claim(User user, Long promotionId, LocalDateTime now) {
        return claim(user, promotionId, now, SOURCE_CLAIM);
    }

    private VoucherView claim(User user, Long promotionId, LocalDateTime now, String source) {
        Promotion p = repo.findById(promotionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy voucher"));
        if (!p.isClaimable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher này không mở để nhận");
        }
        if (!isValid(p, now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher đã hết hạn hoặc hết lượt");
        }
        if (userVoucherRepo.existsByUserIdAndPromotionId(user.getId(), p.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã nhận voucher này rồi");
        }
        UserVoucher uv = new UserVoucher();
        uv.setUser(user);
        uv.setPromotion(p);
        uv.setClaimedAt(now);
        uv.setSource(source);
        userVoucherRepo.save(uv);
        return view(p, uv);
    }

    /**
     * Quà ngẫu nhiên mỗi ngày: bốc một voucher còn nhận trong pool. Giới hạn một lần/ngày
     * để không ai quét hết quà bằng cách bấm liên tục. Chỉ đếm voucher nhận qua đường bốc
     * quà, nên tài khoản vừa đăng ký (đã có voucher chào mừng) vẫn bốc được ngay.
     */
    @Transactional
    public VoucherView lucky(User user, LocalDateTime now) {
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        boolean claimedToday = userVoucherRepo.findByUserIdOrderByClaimedAtDesc(user.getId()).stream()
                .anyMatch(uv -> SOURCE_LUCKY.equals(uv.getSource())
                        && uv.getClaimedAt() != null && !uv.getClaimedAt().isBefore(startOfDay));
        if (claimedToday) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hôm nay bạn đã nhận quà rồi, mai quay lại nhé");
        }
        List<Promotion> pool = claimable(user, now).stream()
                .filter(v -> !v.claimed())
                .map(v -> repo.findById(v.id()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
        if (pool.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hiện chưa có quà mới, bạn quay lại sau nhé");
        }
        Promotion picked = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return claim(user, picked.getId(), now, SOURCE_LUCKY);
    }

    /** Tặng voucher chào mừng ngay sau khi đăng ký; thiếu cấu hình thì bỏ qua, không chặn đăng ký. */
    @Transactional
    public void claimWelcome(User user, LocalDateTime now) {
        repo.findByCodeIgnoreCase(WELCOME_CODE).ifPresent(p -> {
            if (!p.isActive() || userVoucherRepo.existsByUserIdAndPromotionId(user.getId(), p.getId())) return;
            UserVoucher uv = new UserVoucher();
            uv.setUser(user);
            uv.setPromotion(p);
            uv.setClaimedAt(now);
            uv.setSource(SOURCE_WELCOME);
            userVoucherRepo.save(uv);
        });
    }

    /** Ghi nhận voucher đã dùng khi đơn được tạo, trong cùng transaction với đơn. */
    @Transactional
    public void markUsed(User user, Promotion p) {
        if (p == null) return;
        if (p.isClaimable() && user != null) {
            userVoucherRepo.findByUserIdAndPromotionId(user.getId(), p.getId())
                    .ifPresent(uv -> {
                        uv.setUsedAt(LocalDateTime.now());
                        userVoucherRepo.save(uv);
                    });
        }
        incrementUsage(p);
    }

    public static final String WELCOME_CODE = "WELCOME";
    public static final String SOURCE_WELCOME = "WELCOME";
    public static final String SOURCE_CLAIM = "CLAIM";
    public static final String SOURCE_LUCKY = "LUCKY";

    private VoucherView view(Promotion p, UserVoucher uv) {
        return new VoucherView(p.getId(), p.getCode(), p.getName(), p.getDescription(), p.getOccasion(),
                p.getDiscountType(), p.getDiscountValue(), p.getMaxDiscount(), p.getMinOrderTotal(),
                p.getEndsAt(), uv != null, uv != null && uv.getUsedAt() != null);
    }
}