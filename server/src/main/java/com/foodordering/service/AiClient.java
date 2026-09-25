package com.foodordering.service;

import com.foodordering.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Adapter duy nhất của server gọi Gemini; đổi nhà cung cấp AI chỉ cần thay lớp này.
 */
@Service
public class AiClient {
    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final AppProperties props;
    private final RestClient http = RestClient.create();
    private final ObjectMapper mapper = new ObjectMapper();

    public AiClient(AppProperties props) {
        this.props = props;
    }

    public String generate(String systemPrompt, String userPrompt, boolean jsonMode) {
        // Model và API key lấy từ cấu hình; không ghi các giá trị bí mật này vào log.
        String url = BASE_URL + props.getAi().getModel() + ":generateContent?key=" + props.getAi().getApiKey();

        // jsonMode ép Gemini trả về JSON đúng định dạng cho bước trích tiêu chí.
        Map<String, Object> generationConfig = jsonMode
                ? Map.of("temperature", 0.2, "responseMimeType", "application/json")
                : Map.of("temperature", 0.4);

        // Payload gom system instruction, nội dung người dùng và cấu hình sinh.
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))),
                "generationConfig", generationConfig);

        try {
            String raw = http.post().uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode root = mapper.readTree(raw);
            // Đọc candidate đầu tiên và phần text đầu tiên theo cấu trúc phản hồi của Gemini.
            return root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("");
        } catch (Exception e) {
            // Chuẩn hóa lỗi tích hợp để service chatbot có thể áp dụng fallback phù hợp.
            throw new RuntimeException("Không gọi được dịch vụ AI: " + e.getMessage(), e);
        }
    }
}