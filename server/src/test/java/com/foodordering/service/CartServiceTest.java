package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.dto.QuoteDtos.CartQuote;
import com.foodordering.entity.CartItem;
import com.foodordering.entity.Food;
import com.foodordering.entity.User;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra luật giỏ hàng mà không cần database: món ngừng phục vụ không vào giỏ,
 * dòng mới khởi tạo đúng số lượng, và báo giá ủy thác cho PricingService.
 */
class CartServiceTest {
    private CartItemRepository itemRepo;
    private FoodRepository foodRepo;
    private UserRepository userRepo;
    private PricingService pricing;
    private CartService service;

    private static final String EMAIL = "khach@example.com";

    @BeforeEach
    void setUp() {
        itemRepo = mock(CartItemRepository.class);
        foodRepo = mock(FoodRepository.class);
        userRepo = mock(UserRepository.class);
        pricing = mock(PricingService.class);
        service = new CartService(itemRepo, foodRepo, userRepo, pricing);

        User user = new User();
        user.setId(1L);
        user.setEmail(EMAIL);
        when(userRepo.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    @Test
    @DisplayName("Thêm món ngừng phục vụ vào giỏ bị từ chối")
    void themMonNgungPhucVuBiTuChoi() {
        Food food = new Food();
        food.setId(10L);
        food.setName("Phở bò");
        food.setAvailable(false);
        when(foodRepo.findById(10L)).thenReturn(Optional.of(food));

        assertThatThrownBy(() -> service.add(EMAIL, 10L, 1))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không phục vụ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(itemRepo, never()).save(any());
    }

    @Test
    @DisplayName("Thêm món không tồn tại vào giỏ bị từ chối")
    void themMonKhongTonTaiBiTuChoi() {
        when(foodRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.add(EMAIL, 99L, 1))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Món không tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(itemRepo, never()).save(any());
    }

    @Test
    @DisplayName("Dòng giỏ mới bắt đầu từ 0 trước khi cộng số lượng khách chọn")
    void dongMoiTuKhaiTuZero() {
        Food food = new Food();
        food.setId(11L);
        food.setName("Bún chả");
        food.setAvailable(true);
        when(foodRepo.findById(11L)).thenReturn(Optional.of(food));
        // Chưa có dòng nào trong giỏ nên service phải tạo dòng mới.
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.empty());
        when(itemRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CartItem saved = service.add(EMAIL, 11L, 2);

        // Entity mặc định quantity = 1; nếu service quên đặt lại 0 thì lần thêm đầu
        // sẽ ra 3 thay vì 2. Kiểm tra số cuối bắt được lỗi đó.
        assertThat(saved.getQuantity()).isEqualTo(2);

        ArgumentCaptor<CartItem> captor = ArgumentCaptor.forClass(CartItem.class);
        verify(itemRepo).save(captor.capture());
        assertThat(captor.getValue().getQuantity()).isEqualTo(2);
        assertThat(captor.getValue().getFood()).isSameAs(food);
    }

    @Test
    @DisplayName("Thêm món đã có trong giỏ thì cộng dồn số lượng")
    void congDonMonDaCoTrongGio() {
        User user = user();
        Food food = food(11L, "Bún chả");
        CartItem existing = new CartItem();
        existing.setUser(user);
        existing.setFood(food);
        existing.setQuantity(3);
        when(foodRepo.findById(11L)).thenReturn(Optional.of(food));
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.of(existing));
        when(itemRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CartItem saved = service.add(EMAIL, 11L, 2);

        assertThat(saved).isSameAs(existing);
        assertThat(saved.getQuantity()).isEqualTo(5);
    }

    @Test
    @DisplayName("Giỏ hàng của khách trả đúng danh sách dòng")
    void listTraDungDanhSach() {
        CartItem item = new CartItem();
        item.setUser(user());
        item.setFood(food(11L, "Bún chả"));
        item.setQuantity(1);
        when(itemRepo.findByUserIdOrderByIdAsc(1L)).thenReturn(List.of(item));

        List<CartItem> result = service.list(EMAIL);

        assertThat(result).containsExactly(item);
        verify(itemRepo).findByUserIdOrderByIdAsc(1L);
    }

    @Test
    @DisplayName("Cập nhật số lượng món trong giỏ thành công")
    void updateQuantityThanhCong() {
        CartItem item = new CartItem();
        item.setUser(user());
        item.setFood(food(11L, "Bún chả"));
        item.setQuantity(1);
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.of(item));
        when(itemRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CartItem saved = service.updateQuantity(EMAIL, 11L, 4);

        assertThat(saved.getQuantity()).isEqualTo(4);
    }

    @Test
    @DisplayName("Cập nhật món chưa có trong giỏ bị từ chối")
    void updateQuantityMonChuaCoBiTuChoi() {
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateQuantity(EMAIL, 11L, 4))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa có trong giỏ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));

        verify(itemRepo, never()).save(any());
    }

    @Test
    @DisplayName("Xóa một món khỏi giỏ thành công")
    void removeThanhCong() {
        CartItem item = new CartItem();
        item.setUser(user());
        item.setFood(food(11L, "Bún chả"));
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.of(item));

        service.remove(EMAIL, 11L);

        verify(itemRepo).delete(item);
    }

    @Test
    @DisplayName("Xóa món chưa có trong giỏ bị từ chối")
    void removeMonChuaCoBiTuChoi() {
        when(itemRepo.findByUserIdAndFoodId(1L, 11L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(EMAIL, 11L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa có trong giỏ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));

        verify(itemRepo, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa toàn bộ giỏ thành công")
    void clearXoaToanBoGio() {
        service.clear(EMAIL);

        verify(itemRepo).deleteByUserId(1L);
    }

    @Test
    @DisplayName("Email không tồn tại thì thao tác giỏ ném lỗi hệ thống")
    void emailKhongTonTaiNemNoSuchElement() {
        // findByEmail rỗng (không stub) nên mọi thao tác đều chạm orElseThrow() đầu hàm.
        assertThatThrownBy(() -> service.list("la@example.com"))
                .isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(() -> service.add("la@example.com", 11L, 1))
                .isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(() -> service.updateQuantity("la@example.com", 11L, 1))
                .isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(() -> service.remove("la@example.com", 11L))
                .isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(() -> service.clear("la@example.com"))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @DisplayName("Báo giá giỏ ủy thác cho PricingService")
    void quoteUyThacChoPricingService() {
        List<OrderItemRequest> items = List.of(new OrderItemRequest(11L, 2));
        PricingService.PricedCart priced = new PricingService.PricedCart(
                List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        CartQuote quote = new CartQuote(List.of(),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        when(pricing.priceOrder(items)).thenReturn(priced);
        when(pricing.toQuote(priced)).thenReturn(quote);

        CartQuote result = service.quote(items);

        // Client chỉ hiển thị lại con số server tính; CartService không tự tính tiền.
        assertThat(result).isSameAs(quote);
        verify(pricing).priceOrder(items);
        verify(pricing).toQuote(priced);
    }

    private static User user() {
        User u = new User();
        u.setId(1L);
        u.setEmail(EMAIL);
        return u;
    }

    private static Food food(Long id, String name) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setAvailable(true);
        return f;
    }
}
