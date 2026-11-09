package com.foodordering.service;

import com.foodordering.dto.AuthDtos.AuthResponse;
import com.foodordering.dto.AuthDtos.ChangePasswordRequest;
import com.foodordering.dto.AuthDtos.LoginRequest;
import com.foodordering.dto.AuthDtos.RegisterRequest;
import com.foodordering.dto.UserDtos.UserRequest;
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
import static org.mockito.ArgumentMatchers.anyString;
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
    @DisplayName("Đăng ký thành công băm mật khẩu và cấp token")
    void registerThanhCong() {
        when(userRepo.existsByEmail("moi@example.com")).thenReturn(false);
        when(encoder.encode("matkhau123")).thenReturn("hashed-moi");
        when(userRepo.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });

        AuthResponse res = service.register(new RegisterRequest(
                "moi@example.com", "matkhau123", "Nguyễn Văn A", "0900000001", "Địa chỉ"));

        assertThat(res.token()).isEqualTo("token");
        assertThat(res.email()).isEqualTo("moi@example.com");
        assertThat(res.fullName()).isEqualTo("Nguyễn Văn A");
        assertThat(res.role()).isEqualTo("CUSTOMER");
        assertThat(res.id()).isEqualTo(1L);
        verify(encoder).encode("matkhau123");
        verify(userRepo).save(any());
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
    @DisplayName("Đăng nhập thành công cấp token")
    void loginThanhCong() {
        when(userRepo.findByEmail("khach@example.com")).thenReturn(java.util.Optional.of(customer()));
        when(encoder.matches("mat-khau-dung", "hashed")).thenReturn(true);

        AuthResponse res = service.login(new LoginRequest("khach@example.com", "mat-khau-dung"));

        assertThat(res.token()).isEqualTo("token");
        assertThat(res.email()).isEqualTo("khach@example.com");
        assertThat(res.id()).isEqualTo(1L);
        assertThat(res.role()).isEqualTo("CUSTOMER");
        verify(jwtUtil).generateToken("khach@example.com", "CUSTOMER");
    }

    @Test
    @DisplayName("Đăng nhập với email không tồn tại bị từ chối")
    void loginEmailKhongTonTaiBiTuChoi() {
        when(userRepo.findByEmail("khong-co@example.com")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("khong-co@example.com", "mat-khau-dung")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Email không tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.UNAUTHORIZED.value()));

        verify(encoder, never()).matches(anyString(), anyString());
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
    @DisplayName("Đổi mật khẩu với mật khẩu cũ sai bị từ chối")
    void changePasswordSaiBiTuChoi() {
        when(userRepo.findByEmail("khach@example.com")).thenReturn(java.util.Optional.of(customer()));
        when(encoder.matches("mat-khau-sai", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.changePassword("khach@example.com",
                        new ChangePasswordRequest("mat-khau-sai", "mat-khau-moi123")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Mật khẩu hiện tại không đúng")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(encoder, never()).encode(any());
        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("Đổi mật khẩu thành công băm mật khẩu mới")
    void changePasswordThanhCong() {
        User user = customer();
        when(userRepo.findByEmail("khach@example.com")).thenReturn(java.util.Optional.of(user));
        when(encoder.matches("mat-khau-dung", "hashed")).thenReturn(true);
        when(encoder.encode("mat-khau-moi123")).thenReturn("hashed-moi");

        service.changePassword("khach@example.com",
                new ChangePasswordRequest("mat-khau-dung", "mat-khau-moi123"));

        assertThat(user.getPassword()).isEqualTo("hashed-moi");
        verify(userRepo).save(user);
    }

    @Test
    @DisplayName("Tạo tài khoản quản trị với email đã tồn tại bị từ chối")
    void adminCreateTrungEmailBiTuChoi() {
        when(userRepo.existsByEmail("da-co@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.adminCreate(new UserRequest(
                        "da-co@example.com", "matkhau123", "Nguyễn Văn A", "0900000001", null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Email đã tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo tài khoản từ quản trị luôn là khách hàng")
    void adminCreateThanhCong() {
        when(userRepo.existsByEmail("moi@example.com")).thenReturn(false);
        when(encoder.encode("matkhau123")).thenReturn("hashed-moi");
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User saved = service.adminCreate(new UserRequest(
                "moi@example.com", "matkhau123", "Nguyễn Văn A", "0900000001", "Địa chỉ"));

        assertThat(saved.getRole()).isEqualTo(User.Role.CUSTOMER);
        assertThat(saved.getPassword()).isEqualTo("hashed-moi");
        assertThat(saved.getEmail()).isEqualTo("moi@example.com");
    }

    @Test
    @DisplayName("Sửa tài khoản sang email đã tồn tại bị từ chối")
    void adminUpdateTrungEmailBiTuChoi() {
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(customer()));
        when(userRepo.existsByEmail("da-co@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.adminUpdate(1L, new UserRequest(
                        "da-co@example.com", null, "Nguyễn Văn A", "0900000001", null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Email đã tồn tại")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.BAD_REQUEST.value()));

        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("Sửa tài khoản với mật khẩu trống thì giữ nguyên mật khẩu")
    void adminUpdateMatKhauTrongGiuNguyen() {
        User user = customer();
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User saved = service.adminUpdate(1L, new UserRequest(
                "khach@example.com", "", "Tên Mới", "0912345678", null));

        assertThat(saved.getPassword()).isEqualTo("hashed");
        assertThat(saved.getFullName()).isEqualTo("Tên Mới");
        verify(encoder, never()).encode(any());
    }

    @Test
    @DisplayName("Sửa tài khoản với mật khẩu mới thì băm lại")
    void adminUpdateMatKhauMoi() {
        User user = customer();
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));
        when(encoder.encode("mat-khau-moi")).thenReturn("hashed-mới");
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User saved = service.adminUpdate(1L, new UserRequest(
                "khach@example.com", "mat-khau-moi", "Nguyễn Văn A", "0900000001", null));

        assertThat(saved.getPassword()).isEqualTo("hashed-mới");
        verify(encoder).encode("mat-khau-moi");
    }

    @Test
    @DisplayName("Khóa hoặc mở tài khoản khách hàng thành công")
    void setActiveThanhCong() {
        User user = customer();
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User locked = service.setActive(1L, false);

        assertThat(locked.isActive()).isFalse();
        assertThat(user.isActive()).isFalse();
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

    @Test
    @DisplayName("Xóa khách không còn lịch sử thành công")
    void adminDeleteThanhCong() {
        User user = customer();
        when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));
        when(ordersRepo.countByUserId(1L)).thenReturn(0L);
        when(reviewRepo.countByUserId(1L)).thenReturn(0L);

        service.adminDelete(1L);

        // Dữ liệu phụ (giỏ, chat, thông báo) xóa theo tài khoản trước khi xóa user.
        verify(cartItemRepo).deleteByUserId(1L);
        verify(chatRepo).deleteByUserId(1L);
        verify(notificationRepo).deleteByUserId(1L);
        verify(userRepo).delete(user);
    }

    @Test
    @DisplayName("Tìm tài khoản không tồn tại báo 404")
    void findKhongTonTaiBiTuChoi() {
        when(userRepo.findById(99L)).thenReturn(java.util.Optional.empty());

        UserRequest req = new UserRequest("khach@example.com", null, "Nguyễn Văn A", "0900000001", null);
        assertThatThrownBy(() -> service.adminUpdate(99L, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy tài khoản")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));
        assertThatThrownBy(() -> service.setActive(99L, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy tài khoản")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));
        assertThatThrownBy(() -> service.adminDelete(99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Không tìm thấy tài khoản")
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(HttpStatus.NOT_FOUND.value()));
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
