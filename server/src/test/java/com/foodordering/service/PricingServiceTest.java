package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.PromotionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm luật tiền của {@link PricingService}: giảm giá theo từng dòng và chọn chương trình tốt
 * nhất. Đây là chỗ dễ lệch một vài đồng nhất giữa giỏ và đơn.
 */
class PricingServiceTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 10, 0);
    private static final Clock CLOCK =
            Clock.fixed(NOW.atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());

    private PromotionRepository promotionRepo;
    private FoodRepository foodRepo;
    private PricingService pricing;

    private Food food;
    private Food drink;

    @BeforeEach
    void setUp() {
        promotionRepo = mock(PromotionRepository.class);
        foodRepo = mock(FoodRepository.class);
        PromotionService promotionService = new PromotionService(promotionRepo);
        pricing = new PricingService(promotionService, foodRepo, CLOCK);

        Category drinks = new Category();
        drinks.setId(2L);
        food = food(1L, "Cơm gà", 60000);
        drink = food(2L, "Trà đào", 20000);
        food.setCategory(category(1L));
        drink.setCategory(drinks);

        when(foodRepo.findById(1L)).thenReturn(Optional.of(food));
        when(foodRepo.findById(2L)).thenReturn(Optional.of(drink));
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of());
    }

    @Test
    void percentPromotionAppliesToEveryLine() {
        when(promotionRepo.findByActiveTrue())
                .thenReturn(List.of(promotion("Giảm 20%", Promotion.DiscountType.PERCENT, 20)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, 2)));

        assertThat(priced.subtotal()).isEqualByComparingTo("120000");
        assertThat(priced.discountTotal()).isEqualByComparingTo("24000");
        assertThat(priced.total()).isEqualByComparingTo("96000");
        assertThat(priced.lines().get(0).lineDiscount()).isEqualByComparingTo("24000");
    }

    @Test
    void onlyBestAutomaticPromotionAppliesPerLine() {
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(
                promotion("Giảm 10%", Promotion.DiscountType.PERCENT, 10),
                promotion("Giảm 25%", Promotion.DiscountType.PERCENT, 25)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, 1)));

        assertThat(priced.discountTotal()).isEqualByComparingTo("15000");
    }

    @Test
    void categoryPromotionSkipsFoodsOutsideTarget() {
        Promotion weekend = promotion("Cuối tuần", Promotion.DiscountType.PERCENT, 20);
        weekend.setScope(Promotion.Scope.CATEGORY);
        weekend.setTargetIds(List.of(2L));
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(weekend));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, 1), new OrderItemRequest(2L, 1)));

        assertThat(priced.lines().get(0).lineDiscount()).isEqualByComparingTo("0");
        assertThat(priced.lines().get(1).lineDiscount()).isEqualByComparingTo("4000");
        assertThat(priced.total()).isEqualByComparingTo("76000");
    }

    private static Food food(Long id, String name, long price) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setPrice(BigDecimal.valueOf(price));
        f.setAvailable(true);
        f.setImageUrl("/images/foods/x.webp");
        return f;
    }

    private static Category category(Long id) {
        Category c = new Category();
        c.setId(id);
        c.setName("Món chính");
        return c;
    }

    private static Promotion promotion(String name, Promotion.DiscountType type, long value) {
        Promotion p = new Promotion();
        p.setId(1L);
        p.setName(name);
        p.setDiscountType(type);
        p.setDiscountValue(BigDecimal.valueOf(value));
        p.setScope(Promotion.Scope.GLOBAL);
        p.setActive(true);
        p.setStartsAt(NOW.minusDays(1));
        p.setEndsAt(NOW.plusDays(1));
        return p;
    }
}
