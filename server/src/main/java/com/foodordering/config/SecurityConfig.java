package com.foodordering.config;

import com.foodordering.security.JwtFilter;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Ứng dụng dùng JWT stateless, không dựa vào session/cookie nên CSRF không cần cho các request này.
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtFilter jwtFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(req -> {
                var c = new CorsConfiguration();
                c.setAllowedOriginPatterns(List.of("*"));
                c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                c.setAllowedHeaders(List.of("*"));
                return c;
            }))
            // SessionCreationPolicy.STATELESS giữ mỗi request độc lập; không cần lưu phiên trong server.
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            // Các matcher permitAll phục vụ xác thực, thực đơn và chatbot; endpoint admin yêu cầu ROLE_ADMIN.
            .authorizeHttpRequests(auth -> auth
                // Khi controller ném lỗi, Tomcat dispatch sang /error qua DispatcherType.ERROR.
                // Không cho phép riêng thì mọi lỗi 400/404/500 đều bị đổi thành 401, mất thông báo gốc.
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/foods/**", "/api/categories/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/reviews/**", "/api/uploads/**").permitAll()
                .requestMatchers("/api/chatbot/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}