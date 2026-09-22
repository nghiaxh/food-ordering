package com.foodordering.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {
    public record RegisterRequest(
            @Email @NotBlank String email,
            @Size(min = 6) String password,
            @NotBlank String fullName,
            String phone,
            String address) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record AuthResponse(String token, Long id, String email, String fullName, String role) {}

    public record UpdateProfileRequest(String fullName, String phone, String address) {}
}