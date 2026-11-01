package com.foodordering.security;

import com.foodordering.entity.User;
import com.foodordering.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserRepository userRepo;

    public JwtFilter(JwtUtil jwtUtil, UserRepository userRepo) {
        this.jwtUtil = jwtUtil;
        this.userRepo = userRepo;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // Token hợp lệ sẽ dựng SecurityContext để các endpoint phía sau đọc được danh tính.
        // Chỉ header Bearer mới được xử lý; endpoint công khai không cần header này.
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwtUtil.parse(header.substring(7));
                // Token vẫn còn hạn sau khi admin khoá tài khoản, nên phải tra CSDL mỗi request;
                // bỏ qua bước này thì tài khoản bị khoá vẫn dùng được tới khi token hết hạn.
                User user = userRepo.findByEmail(claims.getSubject()).orElse(null);
                if (user == null || !user.isActive()) throw new IllegalStateException("Tài khoản không còn hoạt động");
                var auth = new UsernamePasswordAuthenticationToken(
                        claims.getSubject(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + claims.get("role"))));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                // Token sai/hết hạn được coi như chưa đăng nhập; request vẫn đi qua SecurityConfig.
            }
        }
        // SecurityConfig quyết định endpoint có bắt buộc đăng nhập hay không.
        chain.doFilter(req, res);
    }
}