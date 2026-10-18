package com.foodordering.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Handler lỗi chung. Trước đây exception nào không được xử lý đều thành 500 và trả nguyên
 * văn message của thư việc ra ngoài, lộ cả tên bảng, tên ràng buộc CSDL. Chặn ở đây để
 * client chỉ nhận thông báo tiếng Việt.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> onIntegrityViolation(DataIntegrityViolationException e) {
        // Chi tiết lỗi chỉ nằm trong log server, không gửi xuống client.
        log.warn("Vi phạm ràng buộc dữ liệu: {}", e.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "Dữ liệu đang được tham chiếu ở nơi khác, không thể xoá. "
                        + "Hãy khoá bản ghi thay vì xoá để giữ dữ liệu."));
    }
}