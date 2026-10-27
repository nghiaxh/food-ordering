package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.ComboRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.PromotionRepository;
import com.foodordering.repository.UserVoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm luật tiền của {@link PricingService}: giảm giá theo từng dòng, voucher chia đúng
 * tổng tiền và chặn mã chưa nhận. Đây là chỗ dễ lệch một vài đồng nhất giữa giỏ và đơn.
 */
class PricingServiceTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 10, 0);
    private static final Clock CLOCK =
            Clock.fixed(NOW.atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());

    private PromotionRepository promotionRepo;
    private UserVoucherRepository userVoucherRepo;
    private FoodRepository foodRepo;
    private ComboRepository comboRepo;
    private PricingService pricing;

    private Food food;
    private Food drink;

    @BeforeEach
    void setUp() {
        promotionRepo = mock(PromotionRepository.class);
        userVoucherRepo = mock(UserVoucherRepository.class);
        foodRepo = mock(FoodRepository.class);
        comboRepo = mock(ComboRepository.class);
        PromotionService promotionService = new PromotionService(promotionRepo, userVoucherRepo);
        pricing = new PricingService(promotionService, foodRepo, comboRepo, userVoucherRepo, CLOCK);

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
                .thenReturn(List.of(promotion("Giảm 20%", null, Promotion.DiscountType.PERCENT, 20)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 2)), null, null);

        assertThat(priced.subtotal()).isEqualByComparingTo("120000");
        assertThat(priced.discountTotal()).isEqualByComparingTo("24000");
        assertThat(priced.total()).isEqualByComparingTo("96000");
        assertThat(priced.lines().get(0).lineDiscount()).isEqualByComparingTo("24000");
    }

    @Test
    void onlyBestAutomaticPromotionAppliesPerLine() {
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(
                promotion("Giảm 10%", null, Promotion.DiscountType.PERCENT, 10),
                promotion("Giảm 25%", null, Promotion.DiscountType.PERCENT, 25)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1)), null, null);

        assertThat(priced.discountTotal()).isEqualByComparingTo("15000");
    }

    @Test
    void voucherLargerThanOrderNeverMakesTotalNegative() {
        Promotion voucher = promotion("Giảm 30k", "V30", Promotion.DiscountType.FIXED, 30000);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        Food odd = food(3L, "Chè", 10001);
        when(foodRepo.findById(3L)).thenReturn(Optional.of(odd));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(3L, null, 1)), null, "V30");

        assertThat(priced.discountTotal()).isEqualByComparingTo("10001");
        assertThat(priced.total()).isEqualByComparingTo("0");
    }

    @Test
    void fixedVoucherAllocationSumsToVoucherValue() {
        Promotion voucher = promotion("Giảm 30k", "V30", Promotion.DiscountType.FIXED, 30000);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        Food odd = food(3L, "Chè", 10001);
        when(foodRepo.findById(3L)).thenReturn(Optional.of(odd));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1), new OrderItemRequest(3L, null, 1)),
                null, "V30");

        BigDecimal allocated = priced.lines().stream()
                .map(PricingService.Line::lineDiscount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(allocated).isEqualByComparingTo("30000");
        assertThat(priced.discountTotal()).isEqualByComparingTo("30000");
        assertThat(priced.total()).isEqualByComparingTo("40001");
    }

    @Test
    void voucherBelowMinimumOrderIsRejected() {
        Promotion voucher = promotion("Giảm 20k", "WELCOME", Promotion.DiscountType.FIXED, 20000);
        voucher.setMinOrderTotal(BigDecimal.valueOf(100000));
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));

        assertThatThrownBy(() -> pricing.priceOrder(
                List.of(new OrderItemRequest(2L, null, 1)), null, "WELCOME"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tối thiểu");
    }

    @Test
    void claimableVoucherMustBeInWallet() {
        Promotion voucher = promotion("Khách mới", "WELCOME", Promotion.DiscountType.FIXED, 20000);
        voucher.setClaimable(true);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        when(userVoucherRepo.findByUserIdAndPromotionId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1)), user(9L), "WELCOME"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa nhận");
    }

    @Test
    void categoryPromotionSkipsFoodsOutsideTarget() {
        Promotion weekend = promotion("Cuối tuần", null, Promotion.DiscountType.PERCENT, 20);
        weekend.setScope(Promotion.Scope.CATEGORY);
        weekend.setTargetIds(List.of(2L));
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(weekend));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1), new OrderItemRequest(2L, null, 1)),
                null, null);

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

    private static com.foodordering.entity.User user(Long id) {
        com.foodordering.entity.User u = new com.foodordering.entity.User();
        u.setId(id);
        u.setEmail("khach@example.com");
        return u;
    }

    private static Promotion promotion(String name, String code, Promotion.DiscountType type, long value) {
        Promotion p = new Promotion();
        p.setId(1L);
        p.setName(name);
        p.setCode(code);
        p.setDiscountType(type);
        p.setDiscountValue(BigDecimal.valueOf(value));
        p.setScope(Promotion.Scope.GLOBAL);
        p.setActive(true);
        p.setStartsAt(NOW.minusDays(1));
        p.setEndsAt(NOW.plusDays(1));
        return p;
    }
}
