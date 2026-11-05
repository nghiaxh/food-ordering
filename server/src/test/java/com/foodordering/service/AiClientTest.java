package com.foodordering.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chỉ kiểm phần nhận dạng khóa bị từ chối, không gọi mạng: quyết định này khiến chatbot chuyển
 * từ nhánh dự phòng sang báo "chưa được cấu hình", nên cần phân biệt đúng với lỗi tạm thời.
 */
class AiClientTest {

    @Test
    @DisplayName("401/403 luôn là khóa bị từ chối")
    void maLoiXacThucLaKhoaBiTuChoi() {
        assertThat(AiClient.looksLikeKeyRejection(401, "")).isTrue();
        assertThat(AiClient.looksLikeKeyRejection(403, null)).isTrue();
    }

    @Test
    @DisplayName("Gemini báo khóa sai bằng 400 kèm API_KEY_INVALID")
    void geminiBaoKhoaSaiBang400() {
        String body = "{\"error\":{\"code\":400,\"message\":\"API key not valid. Please pass a valid API key.\","
                + "\"details\":[{\"reason\":\"API_KEY_INVALID\"}]}}";
        assertThat(AiClient.looksLikeKeyRejection(400, body)).isTrue();
    }

    @Test
    @DisplayName("Hết hạn mức hoặc lỗi máy chủ vẫn dùng được nhánh dự phòng")
    void loiTamThoiKhongPhaiKhoaBiTuChoi() {
        assertThat(AiClient.looksLikeKeyRejection(429, "{\"error\":{\"code\":429}}")).isFalse();
        assertThat(AiClient.looksLikeKeyRejection(500, "")).isFalse();
        assertThat(AiClient.looksLikeKeyRejection(400, "{\"error\":{\"message\":\"model not found\"}}")).isFalse();
    }
}
