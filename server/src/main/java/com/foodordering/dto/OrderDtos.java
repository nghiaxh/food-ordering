package com.foodordering.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import java.util.List;

public class OrderDtos {
    /**
     * Hai phương thức thanh toán mà hệ thống hỗ trợ: `COD` (tiền mặt khi nhận) và `QR`
     * (quét mã QR để chuyển khoản). Chặn theo danh sách này để đơn không mang phương thức lạ
     * khiến màn hình không dịch được nhãn hiển thị.
     */
    public static final String PAYMENT_METHOD_PATTERN = "COD|QR";

    public record OrderItemRequest(Long foodId, @Min(1) int quantity) {}

    public record CreateOrderRequest(
            @NotEmpty List<OrderItemRequest> items,
            @NotBlank String receiverName,
            @NotBlank String phone,
            @NotBlank String address,
            @NotBlank @Pattern(regexp = PAYMENT_METHOD_PATTERN, message = "Phương thức thanh toán không hợp lệ") String paymentMethod,
            @Size(max = 255, message = "Lưu ý không được vượt quá 255 ký tự") String note) {}
    public record UpdateStatusRequest(@NotBlank String status) {}

    /**
     * Biểu mẫu quản trị: tạo/sửa đơn thay khách. `items` được phép null khi chỉ sửa thông tin
     * giao hàng của đơn đã xác nhận; lúc tạo đơn thì service kiểm danh sách món không rỗng.
     */
    public record AdminOrderRequest(
            @NotBlank String customerEmail,
            List<OrderItemRequest> items,
            @NotBlank String receiverName,
            @NotBlank String phone,
            @NotBlank String address,
            @NotBlank @Pattern(regexp = PAYMENT_METHOD_PATTERN, message = "Phương thức thanh toán không hợp lệ") String paymentMethod,
            @Size(max = 255, message = "Lưu ý không được vượt quá 255 ký tự") String note,
            String status,
            Boolean paid) {}}