package com.foodordering.service;

import com.foodordering.dto.OrderDtos.AdminOrderRequest;
import com.foodordering.dto.OrderDtos.CreateOrderRequest;
import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.entity.Food;
import com.foodordering.entity.Orders;
import com.foodordering.entity.User;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.NotificationRepository;
import com.foodordering.repository.OrdersRepository;
import com.foodordering.repository.PaymentTransactionRepository;
import com.foodordering.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra vòng đời đơn hàng mà không cần database: khách chỉ hủy đơn đang chờ,
 * trạng thái chỉ đi một chiều, và đơn đã chốt không sửa được.
 */
class OrderServiceTest {
    private OrdersRepository orderRepo;
    private FoodRepository foodRepo;
    private UserRepository userRepo;
    private PaymentTransactionRepository paymentTxRepo;
    private NotificationRepository notificationRepo;
    private PricingService pricing;
    private PromotionService promotionService;
    private OrderService service;

    private static final String EMAIL = "khach@example.com";

    @BeforeEach
    void setUp() {
        orderRepo = mock(OrdersRepository.class);
        foodRepo = mock(FoodRepository.class);
        userRepo = mock(UserRepository.class);
        paymentTxRepo = mock(PaymentTransactionRepository.class);
        notificationRepo = mock(NotificationRepository.class);
        pricing = mock(PricingService.class);
        promotionService = mock(PromotionService.class);
        service = new OrderService(orderRepo, foodRepo, userRepo, paymentTxRepo,
                notificationRepo, pricing, promotionService);

        when(userRepo.findByEmail(EMAIL)).thenReturn(Optional.of(user(1L, EMAIL)));
    }

    @Test
    @DisplayName("Tạo đơn chứa món ngừng phục vụ bị từ chối")
    void createChuaMonNgungPhucVuBiTuChoi() {
        Food food = new Food();
        food.setId(20L);
        food.setName("Bún bò Huế");
        food.setAvailable(false);
        when(foodRepo.findById(20L)).thenReturn(Optional.of(food));

        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null);

        assertThatThrownBy(() -> service.create(EMAIL, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ngừng phục vụ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        // Chặn từ lúc tính tiền để đơn lỗi không được ghi dở.
        verify(pricing, never()).priceOrder(any());
        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Khách chỉ hủy được đơn đang chờ xác nhận")
    void cancelDonKhongPendingBiTuChoi() {
        Orders order = order(100L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(100L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.cancel(EMAIL, 100L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đang chờ xác nhận")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đơn đã thanh toán không tự hủy trên hệ thống")
    void cancelDonDaThanhToanBiTuChoi() {
        Orders order = order(101L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(101L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.cancel(EMAIL, 101L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đã thanh toán")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Chuyển trạng thái không được bỏ bước trong quy trình")
    void updateStatusKhongDuocBoBuoc() {
        Orders order = order(102L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        order.setPaymentMethod("COD");
        when(orderRepo.findById(102L)).thenReturn(Optional.of(order));

        // PENDING -> COMPLETED là nhảy hai bước, phải đi qua CONFIRMED rồi PREPARING.
        assertThatThrownBy(() -> service.updateStatus(102L, "COMPLETED"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không thể chuyển đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Chuyển trạng thái không được đi ngược")
    void updateStatusKhongDuocDiNguoc() {
        Orders order = order(103L, user(1L, EMAIL), Orders.Status.PREPARING, Orders.PaymentStatus.PAID);
        order.setPaymentMethod("COD");
        when(orderRepo.findById(103L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.updateStatus(103L, "CONFIRMED"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không thể chuyển đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đơn đã hoàn thành không thể đổi trạng thái nữa")
    void updateStatusTerminalBiTuChoi() {
        Orders order = order(104L, user(1L, EMAIL), Orders.Status.COMPLETED, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(104L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.updateStatus(104L, "PREPARING"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không thể chuyển đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Không được hủy đơn của người khác")
    void cancelDonCuaNguoiKhacBiTuChoi() {
        Orders order = order(105L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(105L)).thenReturn(Optional.of(order));
        when(userRepo.findByEmail("nguoi-khac@example.com"))
                .thenReturn(Optional.of(user(2L, "nguoi-khac@example.com")));

        assertThatThrownBy(() -> service.cancel("nguoi-khac@example.com", 105L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không có quyền")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.FORBIDDEN.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đơn đã hoàn thành không sửa được nữa")
    void adminUpdateDonHoanThanhBiTuChoi() {
        Orders order = order(106L, user(1L, EMAIL), Orders.Status.COMPLETED, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(106L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.adminUpdate(106L, adminReq()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không sửa được")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đơn đã hủy không sửa được nữa")
    void adminUpdateDonDaHuyBiTuChoi() {
        Orders order = order(107L, user(1L, EMAIL), Orders.Status.CANCELLED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(107L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.adminUpdate(107L, adminReq()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không sửa được")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    private static User user(Long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        return u;
    }

    private static Orders order(Long id, User user, Orders.Status status, Orders.PaymentStatus payment) {
        Orders o = new Orders();
        o.setId(id);
        o.setUser(user);
        o.setStatus(status);
        o.setPaymentStatus(payment);
        o.setPaymentMethod("COD");
        return o;
    }

    private static AdminOrderRequest adminReq() {
        return new AdminOrderRequest(
                EMAIL, null, "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, null);
    }
}
