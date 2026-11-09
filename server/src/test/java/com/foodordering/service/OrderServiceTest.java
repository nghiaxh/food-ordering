package com.foodordering.service;

import com.foodordering.dto.OrderDtos.AdminOrderRequest;
import com.foodordering.dto.OrderDtos.CreateOrderRequest;
import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.entity.Food;
import com.foodordering.entity.Orders;
import com.foodordering.entity.PaymentTransaction;
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
    @DisplayName("Tạo đơn thành công ghi giá từ database và ghi giao dịch thanh toán")
    void createThanhCong() {
        Food food = food(20L, "Bún bò Huế", "70000");
        when(foodRepo.findById(20L)).thenReturn(Optional.of(food));
        when(pricing.priceOrder(any())).thenReturn(pricedOf(food, 1, "70000"));
        when(orderRepo.save(any())).thenAnswer(inv -> {
            Orders o = inv.getArgument(0);
            o.setId(200L);
            return o;
        });

        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", "  Ghi chú  ");

        Orders saved = service.create(EMAIL, req);

        assertThat(saved.getId()).isEqualTo(200L);
        assertThat(saved.getTotal()).isEqualByComparingTo("70000");
        assertThat(saved.getItems()).hasSize(1);
        assertThat(saved.getItems().get(0).getPrice()).isEqualByComparingTo("70000");
        assertThat(saved.getNote()).isEqualTo("Ghi chú");
        // Giá luôn lấy từ DB qua PricingService, không tin số client tự ghi.
        verify(pricing).priceOrder(any());
        verify(promotionService).markUsed(any());
        verify(paymentTxRepo).save(any());
        verify(notificationRepo).save(any());
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
    @DisplayName("Hủy đơn đang chờ và chưa trả thành công")
    void cancelPendingThanhCong() {
        Orders order = order(110L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(110L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Orders saved = service.cancel(EMAIL, 110L);

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.CANCELLED);
        verify(notificationRepo).save(any());
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
    @DisplayName("Chuyển trạng thái hợp lệ từ chờ xác nhận sang đã xác nhận")
    void updateStatusPendingToConfirmedThanhCong() {
        Orders order = order(111L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        order.setPaymentMethod("COD");
        when(orderRepo.findById(111L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Orders saved = service.updateStatus(111L, "CONFIRMED");

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.CONFIRMED);
        verify(notificationRepo).save(any());
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ từ đã xác nhận sang đang vận chuyển")
    void updateStatusConfirmedToPreparingThanhCong() {
        Orders order = order(112L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(112L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Orders saved = service.updateStatus(112L, "PREPARING");

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.PREPARING);
        verify(notificationRepo).save(any());
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ từ đang vận chuyển sang hoàn thành")
    void updateStatusPreparingToCompletedThanhCong() {
        Orders order = order(113L, user(1L, EMAIL), Orders.Status.PREPARING, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(113L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Orders saved = service.updateStatus(113L, "COMPLETED");

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.COMPLETED);
        verify(notificationRepo).save(any());
    }

    @Test
    @DisplayName("Đơn QR chưa thanh toán không được xác nhận")
    void updateStatusQrChuaThanhToanBiTuChoi() {
        Orders order = order(114L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        order.setPaymentMethod("QR");
        when(orderRepo.findById(114L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.updateStatus(114L, "CONFIRMED"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa thanh toán")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Trạng thái đơn không hợp lệ bị từ chối")
    void updateStatusChuoiLaBiTuChoi() {
        Orders order = order(115L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(115L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.updateStatus(115L, "KHONG_CO"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không hợp lệ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));
    }

    @Test
    @DisplayName("Đơn không tìm thấy thì cập nhật trạng thái báo 404")
    void updateStatusDonKhongTonTai() {
        when(orderRepo.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(999L, "CONFIRMED"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));
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
    @DisplayName("Khách xem đơn của mình thành công, email lạ ném lỗi")
    void myOrdersThanhCongVaEmailLaBiTuChoi() {
        Orders order = order(120L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(order));

        assertThat(service.myOrders(EMAIL)).containsExactly(order);
        assertThatThrownBy(() -> service.myOrders("la@example.com"))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @DisplayName("Quản trị xem tất cả đơn thành công")
    void allDonThanhCong() {
        Orders order = order(121L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(order));

        assertThat(service.all()).containsExactly(order);
    }

    @Test
    @DisplayName("Tạo đơn quản trị không có món bị từ chối")
    void adminCreateKhongCoMonBiTuChoi() {
        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(), "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, null);

        assertThatThrownBy(() -> service.adminCreate(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ít nhất một món")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));
    }

    @Test
    @DisplayName("Tạo đơn quản trị QR chưa trả mà xác nhận thẳng bị từ chối")
    void adminCreateQrChuaTraXacNhanBiTuChoi() {
        Food food = food(21L, "Cơm gà", "55000");
        when(foodRepo.findById(21L)).thenReturn(Optional.of(food));
        when(pricing.priceOrder(any())).thenReturn(pricedOf(food, 1, "55000"));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(new OrderItemRequest(21L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "QR", null, "CONFIRMED", false);

        assertThatThrownBy(() -> service.adminCreate(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa thanh toán")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo đơn quản trị thành công có thể ghi đã trả")
    void adminCreateThanhCongCoPaid() {
        Food food = food(21L, "Cơm gà", "55000");
        when(foodRepo.findById(21L)).thenReturn(Optional.of(food));
        when(pricing.priceOrder(any())).thenReturn(pricedOf(food, 1, "55000"));
        when(orderRepo.save(any())).thenAnswer(inv -> {
            Orders o = inv.getArgument(0);
            o.setId(201L);
            return o;
        });
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.empty());

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(new OrderItemRequest(21L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "QR", null, "CONFIRMED", true);

        Orders saved = service.adminCreate(req);

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.CONFIRMED);
        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.PAID);
        assertThat(saved.getTotal()).isEqualByComparingTo("55000");
        verify(promotionService).markUsed(any());
        verify(paymentTxRepo).save(any());
    }

    @Test
    @DisplayName("Quản trị chỉ sửa giao hàng khi đơn đã xác nhận thì cho qua")
    void adminUpdateChiSuaGiaoHangKhiConfirmedChoQua() {
        Orders order = order(122L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(122L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, null, "Người Nhận Mới", "0912345678", "Địa chỉ mới", "COD", "Ghi chú mới", null, null);

        Orders saved = service.adminUpdate(122L, req);

        assertThat(saved.getReceiverName()).isEqualTo("Người Nhận Mới");
        assertThat(saved.getPhone()).isEqualTo("0912345678");
        // Đơn đã xác nhận không còn sửa món nên không tính tiền lại.
        verify(pricing, never()).priceOrder(any());
    }

    @Test
    @DisplayName("Quản trị không sửa được món khi đơn đã xác nhận")
    void adminUpdateSuaMonKhiConfirmedBiTuChoi() {
        Orders order = order(123L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(123L)).thenReturn(Optional.of(order));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, null);

        assertThatThrownBy(() -> service.adminUpdate(123L, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Chỉ sửa được món")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Quản trị sửa được món khi đơn đang chờ và chưa thanh toán")
    void adminUpdateSuaMonKhiPendingChoQua() {
        Food food = food(20L, "Bún bò Huế", "70000");
        Orders order = order(124L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(124L)).thenReturn(Optional.of(order));
        when(foodRepo.findById(20L)).thenReturn(Optional.of(food));
        when(pricing.priceOrder(any())).thenReturn(pricedOf(food, 1, "70000"));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.empty());

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, null);

        Orders saved = service.adminUpdate(124L, req);

        assertThat(saved.getTotal()).isEqualByComparingTo("70000");
        assertThat(saved.getItems()).hasSize(1);
        verify(promotionService).markUsed(any());
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

    @Test
    @DisplayName("Đơn đã hủy thì không thanh toán được")
    void payDonDaHuyBiTuChoi() {
        Orders order = order(125L, user(1L, EMAIL), Orders.Status.CANCELLED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(125L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.pay(EMAIL, 125L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không thanh toán")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));
    }

    @Test
    @DisplayName("Khách tự thanh toán đơn chưa trả thành công")
    void payThanhCong() {
        Orders order = order(126L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(126L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.empty());

        Orders saved = service.pay(EMAIL, 126L);

        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.PAID);
        verify(notificationRepo).save(any());
    }

    @Test
    @DisplayName("Cập nhật thanh toán đồng bộ với giao dịch")
    void updatePaymentDongBoGiaoDich() {
        Orders order = order(127L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(order);
        tx.setStatus(PaymentTransaction.Status.PENDING);
        when(orderRepo.findById(127L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.of(tx));

        Orders saved = service.updatePayment(127L, true);

        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.PAID);
        assertThat(tx.getStatus()).isEqualTo(PaymentTransaction.Status.PAID);
        assertThat(tx.getPaidAt()).isNotNull();
        verify(paymentTxRepo).save(tx);
    }

    @Test
    @DisplayName("Hoàn tác thanh toán về chưa trả thành công")
    void updatePaymentHoanTacThanhCong() {
        Orders order = order(128L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.PAID);
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(order);
        tx.setStatus(PaymentTransaction.Status.PAID);
        when(orderRepo.findById(128L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.of(tx));

        Orders saved = service.updatePayment(128L, false);

        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.UNPAID);
        assertThat(tx.getStatus()).isEqualTo(PaymentTransaction.Status.PENDING);
        assertThat(tx.getPaidAt()).isNull();
    }

    @Test
    @DisplayName("Cập nhật thanh toán giữ nguyên khi đã cùng trạng thái")
    void updatePaymentGiuNguyenKhiDaCungTrangThai() {
        Orders order = order(129L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(129L)).thenReturn(Optional.of(order));

        Orders saved = service.updatePayment(129L, true);

        assertThat(saved).isSameAs(order);
        verify(orderRepo, never()).save(any());
        verify(paymentTxRepo, never()).save(any());
    }

    @Test
    @DisplayName("Quản trị xóa đơn thành công xóa giao dịch trước")
    void adminDeleteThanhCong() {
        Orders order = order(130L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(130L)).thenReturn(Optional.of(order));

        service.adminDelete(130L);

        verify(paymentTxRepo).deleteByOrderId(130L);
        verify(orderRepo).delete(order);
    }

    @Test
    @DisplayName("Xóa đơn không tồn tại báo 404")
    void adminDeleteKhongTonTai() {
        when(orderRepo.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.adminDelete(999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));
    }

    @Test
    @DisplayName("Tạo đơn với dòng hàng không có món bị từ chối")
    void createFoodIdNullBiTuChoi() {
        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(null, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null);

        assertThatThrownBy(() -> service.create(EMAIL, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("phải có món")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(pricing, never()).priceOrder(any());
        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo đơn với món không tồn tại bị từ chối")
    void createMonKhongTonTaiBiTuChoi() {
        when(foodRepo.findById(20L)).thenReturn(Optional.empty());

        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null);

        assertThatThrownBy(() -> service.create(EMAIL, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Món không tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(pricing, never()).priceOrder(any());
        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo đơn với email lạ ném lỗi hệ thống")
    void createEmailLaNemNoSuchElement() {
        when(userRepo.findByEmail("la@example.com")).thenReturn(Optional.empty());

        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(20L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null);

        assertThatThrownBy(() -> service.create("la@example.com", req))
                .isInstanceOf(NoSuchElementException.class);

        verify(pricing, never()).priceOrder(any());
        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo đơn quản trị với khách không tồn tại bị từ chối")
    void adminCreateKhachKhongTonTaiBiTuChoi() {
        when(userRepo.findByEmail("khong-co@example.com")).thenReturn(Optional.empty());

        AdminOrderRequest req = new AdminOrderRequest(
                "khong-co@example.com", List.of(new OrderItemRequest(21L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, null);

        assertThatThrownBy(() -> service.adminCreate(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Khách hàng không tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo đơn quản trị với status lạ bị từ chối")
    void adminCreateStatusLaBiTuChoi() {
        Food food = food(21L, "Cơm gà", "55000");
        when(foodRepo.findById(21L)).thenReturn(Optional.of(food));
        when(pricing.priceOrder(any())).thenReturn(pricedOf(food, 1, "55000"));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, List.of(new OrderItemRequest(21L, 1)),
                "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, "KHONG_CO", null);

        assertThatThrownBy(() -> service.adminCreate(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không hợp lệ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Quản trị đổi trạng thái và ghi đã trả thành công")
    void adminUpdateDoiStatusVaPaidThanhCong() {
        Orders order = order(140L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(140L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.empty());

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, null, "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, "PREPARING", true);

        Orders saved = service.adminUpdate(140L, req);

        assertThat(saved.getStatus()).isEqualTo(Orders.Status.PREPARING);
        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.PAID);
    }

    @Test
    @DisplayName("Quản trị sửa đơn với status lạ bị từ chối")
    void adminUpdateStatusLaBiTuChoi() {
        Orders order = order(141L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(141L)).thenReturn(Optional.of(order));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, null, "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, "KHONG_CO", null);

        assertThatThrownBy(() -> service.adminUpdate(141L, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("không hợp lệ")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Hủy đơn không tồn tại báo 404")
    void cancelDonKhongTonTai() {
        when(orderRepo.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancel(EMAIL, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Hủy đơn với email lạ ném lỗi hệ thống")
    void cancelEmailLaNemNoSuchElement() {
        when(userRepo.findByEmail("la@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancel("la@example.com", 100L))
                .isInstanceOf(NoSuchElementException.class);

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Thanh toán với email lạ ném lỗi hệ thống")
    void payEmailLaNemNoSuchElement() {
        when(userRepo.findByEmail("la@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pay("la@example.com", 100L))
                .isInstanceOf(NoSuchElementException.class);

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Thanh toán đơn không tồn tại báo 404")
    void payDonKhongTonTai() {
        when(orderRepo.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pay(EMAIL, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy đơn")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));

        verify(orderRepo, never()).save(any());
    }

    @Test
    @DisplayName("Quản trị sửa đơn với status không đổi vẫn lưu thành công")
    void adminUpdateGiuNguyenStatusThanhCong() {
        Orders order = order(142L, user(1L, EMAIL), Orders.Status.CONFIRMED, Orders.PaymentStatus.UNPAID);
        when(orderRepo.findById(142L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, null, "Người Nhận Mới", "0912345678", "Địa chỉ mới", "COD", null, "CONFIRMED", null);

        Orders saved = service.adminUpdate(142L, req);

        // Status gửi trùng hiện tại thì bỏ qua transition, vẫn áp địa chỉ mới.
        assertThat(saved.getStatus()).isEqualTo(Orders.Status.CONFIRMED);
        assertThat(saved.getReceiverName()).isEqualTo("Người Nhận Mới");
        verify(pricing, never()).priceOrder(any());
    }

    @Test
    @DisplayName("Quản trị hoàn tác thanh toán về chưa trả thành công")
    void adminUpdatePaidFalseThanhCong() {
        Orders order = order(143L, user(1L, EMAIL), Orders.Status.PENDING, Orders.PaymentStatus.PAID);
        when(orderRepo.findById(143L)).thenReturn(Optional.of(order));
        when(orderRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentTxRepo.findByOrderId(any())).thenReturn(Optional.empty());

        AdminOrderRequest req = new AdminOrderRequest(
                EMAIL, null, "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null, false);

        Orders saved = service.adminUpdate(143L, req);

        assertThat(saved.getPaymentStatus()).isEqualTo(Orders.PaymentStatus.UNPAID);
    }

    private static User user(Long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        return u;
    }

    private static Food food(Long id, String name, String price) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setPrice(new BigDecimal(price));
        f.setAvailable(true);
        return f;
    }

    private static PricingService.PricedCart pricedOf(Food food, int qty, String price) {
        BigDecimal unit = new BigDecimal(price);
        return new PricingService.PricedCart(
                List.of(new PricingService.Line(food, qty, unit, BigDecimal.ZERO, null)),
                unit.multiply(BigDecimal.valueOf(qty)),
                BigDecimal.ZERO,
                unit.multiply(BigDecimal.valueOf(qty)),
                List.of());
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
