package com.foodordering.service;

import com.foodordering.config.AppProperties;
import com.foodordering.repository.AiSettingRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Kiểm phần nhận dạng khóa hỏng và bộ nhớ kiểm tra khóa, không gọi mạng: quyết định này khiến
 * chatbot chuyển từ nhánh dự phòng sang báo "chưa được cấu hình" ngay khi mở trang.
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

    @Test
    @DisplayName("Kiểm tra khóa chỉ gọi nhà cung cấp một lần rồi dùng lại kết quả")
    void chiKiemKhoaMotLan() {
        AiClient client = client("khoa-that");
        doReturn("pong").when(client).generate(anyString(), anyString(), anyBoolean());

        assertThat(client.verifyKey()).isTrue();
        assertThat(client.verifyKey()).isTrue();
        verify(client, times(1)).generate(anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("Khóa rỗng hoặc bị nhà cung cấp từ chối thì báo chưa dùng được")
    void khoaRongHoacBiTuChoi() {
        assertThat(client("").verifyKey()).isFalse();

        AiClient rejected = client("khoa-sai");
        doThrow(new AiClient.AiKeyRejectedException("bị từ chối", null))
                .when(rejected).generate(anyString(), anyString(), anyBoolean());
        assertThat(rejected.verifyKey()).isFalse();
        // Lượt sau không gọi mạng lại: khóa đã bị đánh dấu hỏng.
        assertThat(rejected.verifyKey()).isFalse();
        verify(rejected, times(1)).generate(anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("Lỗi mạng khi kiểm tra thì vẫn cho dùng và chỉ thử lại sau một lúc")
    void loiMangKhiKiemKhoaThiChoTamDung() {
        AiClient client = client("khoa-that");
        doThrow(new RuntimeException("timeout")).when(client).generate(anyString(), anyString(), anyBoolean());

        assertThat(client.verifyKey()).isTrue();
        assertThat(client.verifyKey()).isTrue();
        verify(client, times(1)).generate(anyString(), anyString(), anyBoolean());
    }

    /** Client thật nhưng không gọi mạng: các test tự thay `generate` bằng stub. */
    private static AiClient client(String apiKey) {
        AppProperties props = new AppProperties();
        props.getAi().setApiKey(apiKey);
        return spy(new AiClient(props, mock(AiSettingRepository.class)));
    }
}
