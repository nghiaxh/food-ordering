package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.dto.QuoteDtos.CartQuote;
import com.foodordering.dto.QuoteDtos.QuoteLine;
import com.foodordering.entity.CartItem;
import com.foodordering.entity.Food;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.FoodRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Nơi duy nhất tính tiền của một dòng hàng và của cả đơn.
 *
 * <p>Luật tính, cố ý giữ ở mức một câu: mỗi dòng có giá gốc, một khoản giảm của khuyến mãi
 * tự động tốt nhất đang chạy, và thành tiền. Một dòng không cộng dồn hai chương trình,
 * nên khách nhìn hoá đơn là hiểu.
 *
 * <p>Tổng tiền luôn cộng từ các dòng đã làm tròn, không tính lại từ phần trăm, nên không có
 * chuyện lệch một vài đồng giữa giỏ hàng và đơn đã tạo.
 */
@Service
public class PricingService {
    private final PromotionService promotionService;
    private final FoodRepository foodRepo;
    private final Clock clock;

    public PricingService(PromotionService promotionService,
                          FoodRepository foodRepo, Clock clock) {
        this.promotionService = promotionService;
        this.foodRepo = foodRepo;
        this.clock = clock;
    }

    /** Một dòng đã định giá. `lineDiscount` là số tiền giảm của cả dòng, không phải một phần. */
    public record Line(Food food, int quantity, BigDecimal unitPrice,
                       BigDecimal lineDiscount, String discountLabel) {
        public BigDecimal lineTotal() {
            return unitPrice.multiply(BigDecimal.valueOf(quantity)).subtract(lineDiscount);
        }

        public String name() {
            return food != null ? food.getName() : "";
        }

        public String imageUrl() {
            return food != null ? food.getImageUrl() : null;
        }

        public Long foodId() {
            return food != null ? food.getId() : null;
        }
    }

    public record PricedCart(List<Line> lines, BigDecimal subtotal, BigDecimal discountTotal,
                             BigDecimal total, List<Promotion> appliedPromotions) {}

    public PricedCart priceCart(List<CartItem> items) {
        List<OrderItemRequest> inputs = items.stream()
                .map(i -> new OrderItemRequest(
                        i.getFood() != null ? i.getFood().getId() : null,
                        i.getQuantity()))
                .toList();
        return priceOrder(inputs);
    }

    public PricedCart priceOrder(List<OrderItemRequest> items) {
        LocalDateTime now = LocalDateTime.now(clock);
        RuleSet rules = rules(now);

        List<Line> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        Set<Promotion> applied = new LinkedHashSet<>();

        for (OrderItemRequest input : items) {
            if (input.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số lượng món phải lớn hơn 0");
            }
            if (input.foodId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dòng hàng phải có món");
            }
            Food food = foodRepo.findById(input.foodId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
            BigDecimal unitPrice = food.getPrice();
            if (unitPrice == null) unitPrice = BigDecimal.ZERO;

            Optional<Promotion> auto = bestFor(unitPrice, food, rules);
            BigDecimal autoDiscount = BigDecimal.ZERO;
            String label = null;
            if (auto.isPresent()) {
                Promotion p = auto.get();
                autoDiscount = promotionService.discountAmount(unitPrice, p)
                        .multiply(BigDecimal.valueOf(input.quantity()));
                label = label(p);
                applied.add(p);
            }

            lines.add(new Line(food, input.quantity(), unitPrice, autoDiscount, label));
            subtotal = subtotal.add(unitPrice.multiply(BigDecimal.valueOf(input.quantity())));
        }

        BigDecimal total = lines.stream().map(Line::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = subtotal.subtract(total);
        return new PricedCart(lines, subtotal, discountTotal, total, List.copyOf(applied));
    }

    public CartQuote toQuote(PricedCart priced) {
        List<QuoteLine> lines = priced.lines().stream()
                .map(l -> new QuoteLine(l.foodId(), l.name(), l.imageUrl(), l.unitPrice(),
                        l.lineDiscount(), l.quantity(), l.lineTotal(), l.discountLabel()))
                .toList();
        return new CartQuote(lines, priced.subtotal(), priced.discountTotal(), priced.total());
    }

    // ----- Khuyến mãi tự động -----

    private record RuleSet(LocalDateTime now, List<Promotion> auto, Map<Long, Set<Long>> randomPicks) {}

    private RuleSet rules(LocalDateTime now) {
        List<Promotion> auto = promotionService.activePromotions(now);
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

    private Optional<Promotion> bestFor(BigDecimal unitPrice, Food food, RuleSet rules) {
        Promotion best = null;
        BigDecimal bestAmount = BigDecimal.ZERO;
        for (Promotion p : rules.auto()) {
            if (!matches(p, food)) continue;
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
        return bestFor(food.getPrice(), food, rules);
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

    private void decorateOne(Food f, RuleSet rules) {
        Optional<Promotion> best = bestFor(f.getPrice(), f, rules);
        BigDecimal amount = best.map(p -> promotionService.discountAmount(f.getPrice(), p))
                .orElse(BigDecimal.ZERO);
        f.setDiscountedPrice(f.getPrice().subtract(amount));
        f.setDiscountAmount(amount);
        f.setDiscountPercent(best
                .filter(p -> p.getDiscountType() == Promotion.DiscountType.PERCENT)
                .map(p -> p.getDiscountValue().intValue())
                .orElse(null));
        f.setDiscountLabel(best.map(PricingService::label).orElse(null));
    }

    private static String label(Promotion p) {
        return p.getName();
    }

    private boolean matches(Promotion p, Food food) {
        if (p.getScope() == null) return false;
        return switch (p.getScope()) {
            case GLOBAL -> true;
            case CATEGORY -> food != null && food.getCategory() != null
                    && p.getTargetIds().contains(food.getCategory().getId());
            case FOOD -> food != null && p.getTargetIds().contains(food.getId());
        };
    }
}
