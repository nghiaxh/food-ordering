package com.foodordering.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UserDtos {
    private static final String PHONE = "^0\\d{9}$";

    public record UserRequest(
            @Email @NotBlank String email,
            @Size(min = 8, message = "Mật khẩu phải có ít nhất 8 ký tự") String password,
            @NotBlank String fullName,
            @Pattern(regexp = PHONE, message = "Số điện thoại phải gồm đúng 10 chữ số") String phone,
            String address) {}
}