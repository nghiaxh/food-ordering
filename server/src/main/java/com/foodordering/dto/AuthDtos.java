package com.foodordering.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {
    /** SĐT Việt Nam gồm 10 chữ số và bắt đầu bằng 0. */
    private static final String PHONE = "^0\\d{9}$";

    public record RegisterRequest(
            @Email @NotBlank String email,
            @Size(min = 8, message = "Mật khẩu phải có ít nhất 8 ký tự") String password,
            @NotBlank String fullName,
            @Pattern(regexp = PHONE, message = "Số điện thoại phải gồm đúng 10 chữ số") String phone,
            String address) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record AuthResponse(String token, Long id, String email, String fullName, String role) {}

    public record UpdateProfileRequest(
            @NotBlank String fullName,
            @Pattern(regexp = PHONE, message = "Số điện thoại phải gồm đúng 10 chữ số") String phone,
            String address) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @Size(min = 8, message = "Mật khẩu mới phải có ít nhất 8 ký tự") String newPassword) {}
}