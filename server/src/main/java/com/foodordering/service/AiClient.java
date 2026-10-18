package com.foodordering.service;

import com.foodordering.config.AppProperties;
import com.foodordering.entity.AiSetting;
import com.foodordering.repository.AiSettingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Adapter duy nhất của server gọi dịch vụ AI; đổi nhà cung cấp chỉ cần thay lớp này.
 *
 * <p>Tên mô hình và nhà cung cấp do quản trị viên đặt trong trang Quản lý Chatbot được đọc từ
 * bảng cấu hình, giá trị trong {@code application.yml} chỉ làm mặc định khi admin chưa đặt.
 */
@Service
public class AiClient {
    public static final String PROVIDER_GEMINI = "gemini";
    public static final String PROVIDER_OPENAI = "openai";
    /** Danh sách nhà cung cấp mà giao diện quản trị được phép chọn. */
    public static final List<String> SUPPORTED_PROVIDERS = List.of(PROVIDER_GEMINI, PROVIDER_OPENAI);

    private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    /** Yêu cầu chưa phản hồi trong thời gian này sẽ bị cắt để chatbot kịp trả lời dự phòng. */
    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private final AppProperties props;
    private final AiSettingRepository settingRepo;
    private final RestClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public AiClient(AppProperties props, AiSettingRepository settingRepo) {
        this.props = props;
        this.settingRepo = settingRepo;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public String generate(String systemPrompt, String userPrompt, boolean jsonMode) {
        // Model và API key lấy từ cấu hình; không ghi các giá trị bí mật này vào log.
        String provider = setting("provider", props.getAi().getProvider()).toLowerCase();
        String model = setting("model", props.getAi().getModel());
        String apiKey = props.getAi().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new RuntimeException("Chưa cấu hình khóa API của dịch vụ AI");
        }

        try {
            String raw = PROVIDER_OPENAI.equals(provider)
                    ? callOpenAI(apiKey, model, systemPrompt, userPrompt, jsonMode)
                    : callGemini(apiKey, model, systemPrompt, userPrompt, jsonMode);
            return text(provider, raw);
        } catch (Exception e) {
            // Chuẩn hóa lỗi tích hợp để service chatbot có thể áp dụng fallback phù hợp.
            throw new RuntimeException("Không gọi được dịch vụ AI: " + e.getMessage(), e);
        }
    }

    private String callGemini(String apiKey, String model, String systemPrompt,
                              String userPrompt, boolean jsonMode) {
        // jsonMode ép Gemini trả về JSON đúng định dạng cho bước trích tiêu chí.
        Map<String, Object> generationConfig = jsonMode
                ? Map.of("temperature", 0.2, "responseMimeType", "application/json")
                : Map.of("temperature", 0.4);

        // Payload gom system instruction, nội dung người dùng và cấu hình sinh.
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))),
                "generationConfig", generationConfig);

        return http.post().uri(GEMINI_URL + model + ":generateContent?key=" + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private String callOpenAI(String apiKey, String model, String systemPrompt,
                              String userPrompt, boolean jsonMode) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", jsonMode ? 0.2 : 0.4);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)));
        if (jsonMode) body.put("response_format", Map.of("type", "json_object"));

        return http.post().uri(OPENAI_URL)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    /** Đọc text từ cấu trúc phản hồi, mỗi nhà cung cấp một vị trí khác nhau. */
    private String text(String provider, String raw) throws Exception {
        JsonNode root = mapper.readTree(raw);
        if (PROVIDER_OPENAI.equals(provider)) {
            return root.path("choices").path(0).path("message").path("content").asText("");
        }
        return root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("");
    }

    private String setting(String key, String fallback) {
        return settingRepo.findById(key)
                .map(AiSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .orElse(fallback);
    }
}