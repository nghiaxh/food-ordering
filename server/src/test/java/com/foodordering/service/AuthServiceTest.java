package com.foodordering.service;

import com.foodordering.dto.AuthDtos.LoginRequest;
import com.foodordering.dto.AuthDtos.RegisterRequest;
import com.foodordering.entity.User;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.ChatMessageRepository;
import com.foodordering.repository.NotificationRepository;
import com.foodordering.repository.OrdersRepository;
import com.foodordering.repository.ReviewRepository;
import com.foodordering.repository.UserRepository;
import com.foodordering.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra luật tài khoản mà không cần database: email duy nhất, đăng nhập an toàn,
 * và bảo vệ tài khoản quản trị khỏi khóa, xóa nhầm.
 */
class AuthServiceTest {
    private UserRepository userRepo;
    private CartItemRepository cartItemRepo;
    private OrdersRepository ordersRepo;
    private ReviewRepository reviewRepo;
    private ChatMessageRepository chatRepo;
    private NotificationRepository notificationRepo;
    private PasswordEncoder encoder;
    private JwtUtil jwtUtil;
    private AuthService service;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        cartItemRepo = mock(CartItemRepository.class);
        ordersRepo = mock(OrdersRepository.class);
        reviewRepo = mock(ReviewRepository.class);
        chatRepo = mock(ChatMessageRepository.class);
        notificationRepo = mock(NotificationRepository.class);
        encoder = mock(PasswordEncoder.class);
        jwtUtil = mock(JwtUtil.class);
        service = new AuthService(userRepo, cartItemRepo, ordersRepo, reviewRepo,
                chatRepo, notificationRepo, encoder, jwtUtil);

        when(jwtUtil.generateToken(any(), any())).thenReturn("token");
    }

    @Test
    @DisplayName("Đăng ký với email đã tồn tại bị từ chối")
    void registerTrungEmailBiTuChoi() {
        when(userRepo.existsByEmail("da-co@example.com")).thenReturn(true);

        RegisterRequest req = new RegisterRequest(
                "da-co@example.com", "matkhau123", "Nguyễn Văn A", "0900000001", null);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Email đã tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        // Trùng email thì dừng ngay, chưa băm mật khẩu hay ghi người dùng mới.
        verify(encoder, never()).encode(any());
        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đăng nhập với mật khẩu sai bị từ chối")
    void loginSaiMatKhauBiTuChoi() {
        when(userRepo.findByEmail("khach@example.com")).thenReturn(java.util.Optional.of(customer()));
        when(encoder.matches("mat-khau-sai", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("khach@example.com", "mat-khau-sai")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Mật khẩu không đúng")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.UNAUTHORIZED.value()));
    }

    @Test
    @DisplayName("Tài khoản đã khóa không đăng nhập được")
    void loginTaiKhoanDaKhoaBiTuChoi() {
        User locked = customer();
        locked.setActive(false);
        when(userRepo.findByEmail("khach@example.com")).thenReturn(java.util.Optional.of(locked));
        // Phải đúng mật khẩu để xác minh trình tự: kiểm tra mật khẩu trước rồi mới kiểm tra khóa.
        when(encoder.matches("mat-khau-dung", "hashed")).thenReturn(true);

        assertThatThrownBy(() -> service.login(new LoginRequest("khach@example.com", "mat-khau-dung")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đã bị khóa")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.FORBIDDEN.value()));
    }

    @Test
    @DisplayName("Không khóa được tài khoản quản trị")
    void khongKhoaDuocTaiKhoanQuanTri() {
        User admin = customer();
        admin.setRole(User.Role.ADMIN);
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(admin));

        assertThatThrownBy(() -> service.setActive(1L, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tài khoản quản trị")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("Không xóa được tài khoản quản trị")
    void khongXoaDuocTaiKhoanQuanTri() {
        User admin = customer();
        admin.setRole(User.Role.ADMIN);
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(admin));

        assertThatThrownBy(() -> service.adminDelete(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tài khoản quản trị")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(userRepo, never()).delete(any());
    }

    @Test
    @DisplayName("Không xóa được khách đã có đơn hàng")
    void adminDeleteKhachDaCoDonBiTuChoi() {
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(customer()));
        when(ordersRepo.countByUserId(1L)).thenReturn(2L);
        when(reviewRepo.countByUserId(1L)).thenReturn(0L);

        assertThatThrownBy(() -> service.adminDelete(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đơn hàng")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.CONFLICT.value()));

        // Còn lịch sử thì phải giữ lại; chặn trước khi xóa dữ liệu phụ và user.
        verify(userRepo, never()).delete(any());
        verify(cartItemRepo, never()).deleteByUserId(any());
        verify(chatRepo, never()).deleteByUserId(any());
        verify(notificationRepo, never()).deleteByUserId(any());
    }

    @Test
    @DisplayName("Không xóa được khách đã có đánh giá")
    void adminDeleteKhachDaCoDanhGiaBiTuChoi() {
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(customer()));
        when(ordersRepo.countByUserId(1L)).thenReturn(0L);
        when(reviewRepo.countByUserId(1L)).thenReturn(1L);

        assertThatThrownBy(() -> service.adminDelete(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đánh giá")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.CONFLICT.value()));

        verify(userRepo, never()).delete(any());
    }

    private static User customer() {
        User u = new User();
        u.setId(1L);
        u.setEmail("khach@example.com");
        u.setPassword("hashed");
        u.setFullName("Nguyễn Văn A");
        u.setRole(User.Role.CUSTOMER);
        u.setActive(true);
        return u;
    }
}
