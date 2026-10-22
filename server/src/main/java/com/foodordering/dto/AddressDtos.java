package com.foodordering.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AddressDtos {
    /** SĐT Việt Nam gồm 10 chữ số và bắt đầu bằng 0. */
    private static final String PHONE = "^0\\d{9}$";

    public record AddressRequest(
            @Size(max = 50, message = "Nhãn địa chỉ tối đa 50 ký tự") String label,
            @NotBlank(message = "Nhập tên người nhận") String receiverName,
            @Pattern(regexp = PHONE, message = "Số điện thoại phải gồm đúng 10 chữ số") String phone,
            @NotBlank(message = "Nhập địa chỉ giao hàng") String address,
            boolean isDefault) {}

    public record AddressResponse(
            Long id,
            String label,
            String receiverName,
            String phone,
            String address,
            boolean isDefault) {}
}
