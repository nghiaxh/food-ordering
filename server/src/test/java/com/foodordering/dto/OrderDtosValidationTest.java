package com.foodordering.dto;

import com.foodordering.dto.OrderDtos.CreateOrderRequest;
import com.foodordering.dto.OrderDtos.OrderItemRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.hibernate.validator.messageinterpolation.ParameterMessageInterpolator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kiểm chứng ràng buộc biên của biểu mẫu đặt món. Test ở mức DTO nên không cần database
 * hay Docker; validator được dựng trực tiếp từ hibernate-validator.
 */
class OrderDtosValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        // ParameterMessageInterpolator không cần EL implementation nên test chạy được
        // mà không cần thêm dependency vào pom.xml.
        factory = Validation.byDefaultProvider()
                .configure()
                .messageInterpolator(new ParameterMessageInterpolator())
                .buildValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"COD", "QR"})
    @DisplayName("Phương thức thanh toán hợp lệ đều được chấp nhận")
    void phuongThucHopLe(String method) {
        assertThat(validator.validate(datDon(method))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"cod", "qr", "CASH", "BANK_TRANSFER", "MOMO", "COD; DROP TABLE orders"})
    @DisplayName("Phương thức thanh toán ngoài danh sách bị chặn")
    void phuongThucKhongHopLe(String method) {
        assertThat(validator.validate(datDon(method)))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("paymentMethod"));
    }

    @Test
    @DisplayName("Phương thức thanh toán rỗng bị chặn")
    void phuongThucRong() {
        assertThat(validator.validate(datDon("")))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("paymentMethod"));
        assertThat(validator.validate(datDon(null)))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("paymentMethod"));
    }

    @Test
    @DisplayName("Ghi chú quá 255 ký tự bị chặn")
    void ghiChuQuaDoDai() {
        CreateOrderRequest req = new CreateOrderRequest(
                List.of(new OrderItemRequest(1L, null, 1)), "Nguyễn Văn A", "0900000001", "Địa chỉ",
                "COD", "x".repeat(256), null);
        assertThat(validator.validate(req))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("note"));
    }

    @Test
    @DisplayName("Đơn không có món nào bị chặn")
    void donKhongCoMon() {
        CreateOrderRequest req = new CreateOrderRequest(
                List.of(), "Nguyễn Văn A", "0900000001", "Địa chỉ", "COD", null, null);
        assertThat(validator.validate(req))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("items"));
    }

    private CreateOrderRequest datDon(String paymentMethod) {
        return new CreateOrderRequest(
                List.of(new OrderItemRequest(1L, null, 1)), "Nguyễn Văn A", "0900000001", "Địa chỉ",
                paymentMethod, null, null);
    }
}
