package com.foodordering.service;

import com.foodordering.dto.AuthDtos.*;
import com.foodordering.dto.UserDtos.UserRequest;
import com.foodordering.entity.User;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.ChatMessageRepository;
import com.foodordering.repository.NotificationRepository;
import com.foodordering.repository.OrdersRepository;
import com.foodordering.repository.ReviewRepository;
import com.foodordering.repository.UserRepository;
import com.foodordering.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
public class AuthService {
    private final UserRepository userRepo;
    private final CartItemRepository cartItemRepo;
    private final OrdersRepository ordersRepo;
    private final ReviewRepository reviewRepo;
    private final ChatMessageRepository chatRepo;
    private final NotificationRepository notificationRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepo, CartItemRepository cartItemRepo,
                       OrdersRepository ordersRepo, ReviewRepository reviewRepo,
                       ChatMessageRepository chatRepo, NotificationRepository notificationRepo,
                       PasswordEncoder encoder, JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.cartItemRepo = cartItemRepo;
        this.ordersRepo = ordersRepo;
        this.reviewRepo = reviewRepo;
        this.chatRepo = chatRepo;
        this.notificationRepo = notificationRepo;
        this.encoder = encoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepo.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email đã tồn tại");
        }
        User u = new User();
        u.setEmail(req.email());
        u.setPassword(encoder.encode(req.password()));
        u.setFullName(req.fullName());
        u.setPhone(req.phone());
        u.setAddress(req.address());
        userRepo.save(u);
        return toResponse(u);
    }

    public AuthResponse login(LoginRequest req) {
        User u = userRepo.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email không tồn tại"));
        if (!encoder.matches(req.password(), u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Mật khẩu không đúng");
        }
        if (!u.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa");
        }
        return toResponse(u);
    }

    /** Đổi mật khẩu phải xác minh mật khẩu cũ trước, nếu không ai có token cũng đổi được. */
    public void changePassword(String email, ChangePasswordRequest req) {
        User u = userRepo.findByEmail(email).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu hiện tại không đúng");
        }
        u.setPassword(encoder.encode(req.newPassword()));
        userRepo.save(u);
    }

    // ----- Quản trị tài khoản khách hàng (UC13) -----

    public User adminCreate(UserRequest req) {
        if (userRepo.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email đã tồn tại");
        }
        User u = new User();
        u.setEmail(req.email());
        u.setPassword(encoder.encode(req.password()));
        u.setFullName(req.fullName());
        u.setPhone(req.phone());
        u.setAddress(req.address());
        // Tài khoản tạo từ trang quản trị luôn là khách hàng; admin do hệ thống cấp sẵn.
        u.setRole(User.Role.CUSTOMER);
        return userRepo.save(u);
    }

    public User adminUpdate(Long id, UserRequest req) {
        User u = find(id);
        if (!u.getEmail().equals(req.email()) && userRepo.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email đã tồn tại");
        }
        u.setEmail(req.email());
        u.setFullName(req.fullName());
        u.setPhone(req.phone());
        u.setAddress(req.address());
        // Mật khẩu để trống nghĩa là giữ nguyên mật khẩu hiện tại.
        if (req.password() != null && !req.password().isBlank()) {
            u.setPassword(encoder.encode(req.password()));
        }
        return userRepo.save(u);
    }

    /** Khóa hoặc xóa tài khoản quản trị sẽ làm mất quyền truy cập hệ thống nên bị chặn. */
    public User setActive(Long id, boolean active) {
        User u = find(id);
        requireCustomer(u, "tài khoản quản trị");
        u.setActive(active);
        return userRepo.save(u);
    }

    @Transactional
    public void adminDelete(Long id) {
        User u = find(id);
        requireCustomer(u, "tài khoản quản trị");
        // Đơn, đánh giá, tin nhắn và thông báo đều giữ khoá ngoại tới users. Xoá user khi
        // còn các bản ghi đó sẽ vi phạm khoá ngoại và làm hỏng lịch sử đơn hàng, nên chặn
        // trước và trả 409. Muốn ngừng phục vụ khách thì khoá tài khoản thay vì xoá.
        long orders = ordersRepo.countByUserId(id);
        long reviews = reviewRepo.countByUserId(id);
        if (orders > 0 || reviews > 0) {
            List<String> parts = new ArrayList<>();
            if (orders > 0) parts.add(orders + " đơn hàng");
            if (reviews > 0) parts.add(reviews + " đánh giá");
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không xoá được: khách đã có " + String.join(" và ", parts)
                            + ". Hãy khoá tài khoản để giữ lịch sử.");
        }
        // Giỏ và thông báo là dữ liệu phụ nên xoá theo; tin nhắn chatbot vẫn giữ để lịch sử hội thoại.
        cartItemRepo.deleteByUserId(id);
        chatRepo.deleteByUserId(id);
        notificationRepo.deleteByUserId(id);
        userRepo.delete(u);
    }

    private User find(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản"));
    }

    private void requireCustomer(User u, String what) {
        if (u.getRole() == User.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể thao tác trên " + what);
        }
    }

    private AuthResponse toResponse(User u) {
        String token = jwtUtil.generateToken(u.getEmail(), u.getRole().name());
        return new AuthResponse(token, u.getId(), u.getEmail(), u.getFullName(), u.getRole().name());
    }
}