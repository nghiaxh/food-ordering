package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.dto.QuoteDtos.CartQuote;
import com.foodordering.dto.QuoteDtos.QuoteLine;
import com.foodordering.entity.CartItem;
import com.foodordering.entity.Combo;
import com.foodordering.entity.Food;
import com.foodordering.entity.Promotion;
import com.foodordering.entity.User;
import com.foodordering.entity.UserVoucher;
import com.foodordering.repository.ComboRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.UserVoucherRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Nơi duy nhất tính tiền của một dòng hàng và của cả đơn.
 *
 * <p>Luật tính, cố ý giữ ở mức một câu: mỗi dòng có giá gốc, một khoản giảm, và thành tiền.
 * Khuyến mãi tự động (không có mã) chọn chương trình tốt nhất cho từng dòng; voucher áp tiếp
 * trên phần còn lại của những dòng khớp phạm vi. Một dòng không cộng dồn hai chương trình
 * tự động, nên khách nhìn hoá đơn là hiểu.
 *
 * <p>Tổng tiền luôn cộng từ các dòng đã làm tròn, không tính lại từ phần trăm, nên không có
 * chuyện lệch một vài đồng giữa giỏ hàng và đơn đã tạo.
 */
@Service
public class PricingService {
    private final PromotionService promotionService;
    private final FoodRepository foodRepo;
    private final ComboRepository comboRepo;
    private final UserVoucherRepository userVoucherRepo;
    private final Clock clock;

    public PricingService(PromotionService promotionService,
                          FoodRepository foodRepo, ComboRepository comboRepo,
                          UserVoucherRepository userVoucherRepo, Clock clock) {
        this.promotionService = promotionService;
        this.foodRepo = foodRepo;
        this.comboRepo = comboRepo;
        this.userVoucherRepo = userVoucherRepo;
        this.clock = clock;
    }

    /** Một dòng đã định giá. `lineDiscount` là số tiền giảm của cả dòng, không phải một phần. */
    public record Line(Food food, Combo combo, int quantity, BigDecimal unitPrice,
                       BigDecimal lineDiscount, String discountLabel) {
        public BigDecimal lineTotal() {
            return unitPrice.multiply(BigDecimal.valueOf(quantity)).subtract(lineDiscount);
        }

        public String name() {
            if (food != null) return food.getName();
            return combo != null ? combo.getName() : "";
        }

        public String imageUrl() {
            if (food != null) return food.getImageUrl();
            return combo != null ? combo.getImageUrl() : null;
        }

        public Long foodId() {
            return food != null ? food.getId() : null;
        }

        public Long comboId() {
            return combo != null ? combo.getId() : null;
        }
    }

    public record PricedCart(List<Line> lines, BigDecimal subtotal, BigDecimal discountTotal,
                             BigDecimal total, Promotion voucher) {}

    private record LineInput(Long foodId, Long comboId, int quantity) {}

    public PricedCart priceCart(List<CartItem> items, User user, String voucherCode) {
        List<LineInput> inputs = items.stream()
                .map(i -> new LineInput(
                        i.getFood() != null ? i.getFood().getId() : null,
                        i.getCombo() != null ? i.getCombo().getId() : null,
                        i.getQuantity()))
                .toList();
        return price(inputs, user, voucherCode);
    }

    public PricedCart priceOrder(List<OrderItemRequest> items, User user, String voucherCode) {
        List<LineInput> inputs = items.stream()
                .map(i -> new LineInput(i.foodId(), i.comboId(), i.quantity()))
                .toList();
        return price(inputs, user, voucherCode);
    }

    public CartQuote toQuote(PricedCart priced) {
        List<QuoteLine> lines = priced.lines().stream()
                .map(l -> new QuoteLine(l.foodId(), l.comboId(), l.name(), l.imageUrl(), l.unitPrice(),
                        l.lineDiscount(), l.quantity(), l.lineTotal(), l.discountLabel()))
                .toList();
        return new CartQuote(lines, priced.subtotal(), priced.discountTotal(), priced.total(),
                priced.voucher() != null ? priced.voucher().getCode() : null,
                priced.voucher() != null ? priced.voucher().getName() : null);
    }

    private PricedCart price(List<LineInput> inputs, User user, String voucherCode) {
        LocalDateTime now = LocalDateTime.now(clock);
        RuleSet rules = rules(now);

        List<Line> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (LineInput input : inputs) {
            if (input.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số lượng món phải lớn hơn 0");
            }
            Food food = null;
            Combo combo = null;
            BigDecimal unitPrice;
            if (input.foodId() != null) {
                food = foodRepo.findById(input.foodId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
                unitPrice = food.getPrice();
            } else if (input.comboId() != null) {
                combo = comboRepo.findById(input.comboId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Combo không tồn tại"));
                unitPrice = combo.getPrice();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dòng hàng phải có món hoặc combo");
            }
            if (unitPrice == null) unitPrice = BigDecimal.ZERO;

            Optional<Promotion> auto = bestFor(unitPrice, food, combo, rules);
            BigDecimal autoDiscount = BigDecimal.ZERO;
            String label = null;
            if (auto.isPresent()) {
                Promotion p = auto.get();
                autoDiscount = promotionService.discountAmount(unitPrice, p)
                        .multiply(BigDecimal.valueOf(input.quantity()));
                label = label(p);
            }

            lines.add(new Line(food, combo, input.quantity(), unitPrice, autoDiscount, label));
            subtotal = subtotal.add(unitPrice.multiply(BigDecimal.valueOf(input.quantity())));
        }

        BigDecimal afterAuto = lines.stream().map(Line::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);

        Promotion voucher = promotionService.validateVoucher(voucherCode, afterAuto, now);
        if (voucher != null) {
            requireOwned(voucher, user);
            applyVoucher(voucher, lines);
        }

        BigDecimal total = lines.stream().map(Line::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = subtotal.subtract(total);
        return new PricedCart(lines, subtotal, discountTotal, total, voucher);
    }

    /**
     * Voucher áp trên phần còn lại của từng dòng khớp phạm vi. Với voucher giảm số tiền cố
     * định, khoản giảm được chia theo tỉ lệ giá từng dòng và dòng cuối nhận phần dư, nhờ vậy
     * tổng giảm đúng bằng giá trị voucher mà không lệch đồng nào.
     */
    private void applyVoucher(Promotion voucher, List<Line> lines) {
        List<Integer> eligible = new ArrayList<>();
        BigDecimal eligibleTotal = BigDecimal.ZERO;
        for (int i = 0; i < lines.size(); i++) {
            Line line = lines.get(i);
            if (!matches(voucher, line.food(), line.combo())) continue;
            BigDecimal base = line.lineTotal();
            if (base.signum() <= 0) continue;
            eligible.add(i);
            eligibleTotal = eligibleTotal.add(base);
        }
        if (eligible.isEmpty() || eligibleTotal.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Mã khuyến mãi không áp dụng cho món nào trong giỏ");
        }
        promotionService.requireMinOrderTotal(voucher,
                lines.stream().map(Line::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add));

        BigDecimal budget;
        if (voucher.getDiscountType() == Promotion.DiscountType.PERCENT) {
            budget = eligibleTotal.multiply(voucher.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            if (voucher.getMaxDiscount() != null && budget.compareTo(voucher.getMaxDiscount()) > 0) {
                budget = voucher.getMaxDiscount();
            }
        } else {
            budget = voucher.getDiscountValue();
        }
        if (budget.signum() <= 0) return;
        if (budget.compareTo(eligibleTotal) > 0) budget = eligibleTotal;

        BigDecimal allocated = BigDecimal.ZERO;
        for (int k = 0; k < eligible.size(); k++) {
            int index = eligible.get(k);
            Line line = lines.get(index);
            BigDecimal base = line.lineTotal();
            BigDecimal share;
            if (k == eligible.size() - 1) {
                share = budget.subtract(allocated);
            } else {
                share = budget.multiply(base).divide(eligibleTotal, 0, RoundingMode.HALF_UP);
            }
            if (share.compareTo(base) > 0) share = base;
            if (share.signum() < 0) share = BigDecimal.ZERO;
            allocated = allocated.add(share);
            lines.set(index, new Line(line.food(), line.combo(), line.quantity(), line.unitPrice(),
                    line.lineDiscount().add(share), label(line.discountLabel(), voucher)));
        }
    }

    private static String label(String current, Promotion voucher) {
        String next = voucher.getCode() != null ? voucher.getCode() : voucher.getName();
        if (current == null || current.isBlank()) return next;
        return current + " + " + next;
    }

    /** Voucher nhận trong ví mới dùng được; mã admin phát ngoài hệ thống thì không cần bước nhận. */
    private void requireOwned(Promotion voucher, User user) {
        if (!voucher.isClaimable()) return;
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để dùng voucher này");
        }
        UserVoucher owned = userVoucherRepo.findByUserIdAndPromotionId(user.getId(), voucher.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Bạn chưa nhận voucher này"));
        if (owned.getUsedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher này đã được dùng");
        }
    }

    // ----- Khuyến mãi tự động -----

    private record RuleSet(LocalDateTime now, List<Promotion> auto, Map<Long, Set<Long>> randomPicks) {}

    private RuleSet rules(LocalDateTime now) {
        List<Promotion> active = promotionService.activePromotions(now);
        List<Promotion> auto = active.stream()
                .filter(p -> p.getCode() == null || p.getCode().isBlank())
                .toList();
        Map<Long, Set<Long>> picks = new HashMap<>();
        boolean needsPicks = auto.stream().anyMatch(p -> p.getRandomCount() > 0);
        if (needsPicks) {
            List<Food> available = foodRepo.findAllByAvailableTrue();
            LocalDate day = now.toLocalDate();
            for (Promotion p : auto) {
                if (p.getRandomCount() <= 0) continue;
                List<Long> ids = available.stream()
                        .map(Food::getId)
                        .sorted(Comparator
                                .comparingInt((Long id) -> Objects.hash(id, p.getId(), day))
                                .thenComparing(Comparator.naturalOrder()))
                        .limit(p.getRandomCount())
                        .toList();
                picks.put(p.getId(), new HashSet<>(ids));
            }
        }
        return new RuleSet(now, auto, picks);
    }

    private Optional<Promotion> bestFor(BigDecimal unitPrice, Food food, Combo combo, RuleSet rules) {
        Promotion best = null;
        BigDecimal bestAmount = BigDecimal.ZERO;
        for (Promotion p : rules.auto()) {
            if (!matches(p, food, combo)) continue;
            if (p.getRandomCount() > 0) {
                Set<Long> picked = rules.randomPicks().get(p.getId());
                if (food == null || picked == null || !picked.contains(food.getId())) continue;
            }
            BigDecimal amount = promotionService.discountAmount(unitPrice, p);
            if (amount.signum() <= 0) continue;
            if (best == null
                    || amount.compareTo(bestAmount) > 0
                    || (amount.compareTo(bestAmount) == 0 && p.getPriority() > best.getPriority())) {
                best = p;
                bestAmount = amount;
            }
        }
        return Optional.ofNullable(best);
    }

    /** Giảm giá đang áp cho một món, dùng để hiện giá trên thẻ món. */
    public Optional<Promotion> bestForFood(Food food) {
        RuleSet rules = rules(LocalDateTime.now(clock));
        return bestFor(food.getPrice(), food, null, rules);
    }

    public Optional<Promotion> bestForCombo(Combo combo) {
        RuleSet rules = rules(LocalDateTime.now(clock));
        return bestFor(combo.getPrice(), null, combo, rules);
    }

    /**
     * Điền giá đã giảm và nhãn ưu đãi cho danh sách món trước khi trả về client.
     * Gọi một lần cho cả danh sách để không truy vấn khuyến mãi lặp lại từng món.
     */
    public void decorateFoods(List<Food> foods) {
        if (foods.isEmpty()) return;
        RuleSet rules = rules(LocalDateTime.now(clock));
        for (Food f : foods) decorateOne(f, rules);
    }

    public void decorateCombos(List<Combo> combos) {
        if (combos.isEmpty()) return;
        RuleSet rules = rules(LocalDateTime.now(clock));
        for (Combo c : combos) {
            Discount d = bestDiscount(c.getPrice(), null, c, rules);
            c.setDiscountedPrice(c.getPrice().subtract(d.amount()));
            c.setDiscountAmount(d.amount());
            c.setDiscountPercent(d.percent());
            c.setDiscountLabel(d.label());
        }
    }

    private void decorateOne(Food f, RuleSet rules) {
        Discount d = bestDiscount(f.getPrice(), f, null, rules);
        f.setDiscountedPrice(f.getPrice().subtract(d.amount()));
        f.setDiscountAmount(d.amount());
        f.setDiscountPercent(d.percent());
        f.setDiscountLabel(d.label());
    }

    /** Kết quả định giá một món/combo; `amount` là số tiền giảm trên một phần. */
    private record Discount(BigDecimal amount, Integer percent, String label) {}

    private Discount bestDiscount(BigDecimal price, Food food, Combo combo, RuleSet rules) {
        Optional<Promotion> best = bestFor(price, food, combo, rules);
        BigDecimal amount = best.map(p -> promotionService.discountAmount(price, p))
                .orElse(BigDecimal.ZERO);
        return new Discount(amount, percent(best), best.map(PricingService::label).orElse(null));
    }

    private static Integer percent(Optional<Promotion> promotion) {
        return promotion
                .filter(p -> p.getDiscountType() == Promotion.DiscountType.PERCENT)
                .map(p -> p.getDiscountValue().intValue())
                .orElse(null);
    }

    private static String label(Promotion p) {
        return p.getOccasion() != null && !p.getOccasion().isBlank() ? p.getOccasion() : p.getName();
    }

    private boolean matches(Promotion p, Food food, Combo combo) {
        if (p.getScope() == null) return false;
        return switch (p.getScope()) {
            case GLOBAL -> true;
            case CATEGORY -> food != null && food.getCategory() != null
                    && p.getTargetIds().contains(food.getCategory().getId());
            case FOOD -> food != null && p.getTargetIds().contains(food.getId());
            case COMBO -> combo != null && p.getTargetIds().contains(combo.getId());
        };
    }
}
