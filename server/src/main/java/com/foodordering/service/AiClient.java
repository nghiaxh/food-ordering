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
import org.springframework.web.client.HttpClientErrorException;
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
    /** Nhà cung cấp đã từ chối khóa ở một lượt trước; giữ lại để các lượt sau báo như thiếu khóa. */
    private volatile boolean credentialsRejected = false;
    /** Kết quả kiểm tra khóa với nhà cung cấp; null là chưa kiểm tra lần nào. */
    private volatile Boolean keyAccepted = null;
    /** Lần thử gần nhất không kết luận được (mạng, quota), dùng để giãn nhịp thử lại. */
    private volatile long probeFailedAt = 0;

    /** Câu thử tối giản để biết nhà cung cấp có chấp nhận khóa không. */
    private static final String PROBE_SYSTEM = "Bạn là máy kiểm tra kết nối. Trả lời đúng một từ.";
    private static final String PROBE_USER = "ping";
    /** Chờ ngần này trước khi thử lại sau một lần không kết luận được, tránh gọi mạng mỗi lần mở trang. */
    private static final long PROBE_RETRY_MS = 5 * 60 * 1000L;

    /** Khóa API bị nhà cung cấp từ chối (sai, hết hạn, chưa bật API) - không phải lỗi tạm thời. */
    public static class AiKeyRejectedException extends RuntimeException {
        AiKeyRejectedException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public AiClient(AppProperties props, AiSettingRepository settingRepo) {
        this.props = props;
        this.settingRepo = settingRepo;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    /**
     * Trợ lý có dùng được không: khóa API đã được cấu hình và chưa bị nhà cung cấp từ chối.
     * Chatbot dùng cờ này để bỏ qua lời gọi mạng khi thiếu/hỏng khóa, tránh chờ hết timeout rồi
     * mới rơi sang nhánh dự phòng. Không trả về hay log giá trị khóa.
     */
    public boolean isConfigured() {
        String apiKey = props.getAi().getApiKey();
        return apiKey != null && !apiKey.isBlank() && !credentialsRejected;
    }

    /**
     * Khóa có được nhà cung cấp chấp nhận không. Lần đầu gọi thử một câu tối giản rồi giữ kết
     * quả, nhờ vậy mở trang là biết ngay khóa sai thay vì đợi tới lượt chat đầu tiên. Lỗi
     * mạng/quota không kết luận được thì coi như dùng được và chỉ thử lại sau một lúc.
     */
    public synchronized boolean verifyKey() {
        if (!isConfigured()) return false;
        if (keyAccepted != null) return keyAccepted;
        if (System.currentTimeMillis() - probeFailedAt < PROBE_RETRY_MS) return true;
        try {
            generate(PROBE_SYSTEM, PROBE_USER, false);
            keyAccepted = true;
            return true;
        } catch (AiKeyRejectedException e) {
            credentialsRejected = true;
            return false;
        } catch (RuntimeException e) {
            probeFailedAt = System.currentTimeMillis();
            return true;
        }
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
            // Khóa sai/hết hạn: đánh dấu để các lượt sau báo "chưa cấu hình" thay vì dự phòng.
            if (isKeyRejected(e)) {
                credentialsRejected = true;
                throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", e);
            }
            // Lỗi tạm thời (mạng, hết thời gian chờ, JSON hỏng): service chatbot tự dự phòng.
            throw new RuntimeException("Không gọi được dịch vụ AI: " + e.getMessage(), e);
        }
    }

    private static boolean isKeyRejected(Exception e) {
        if (!(e instanceof HttpClientErrorException err)) return false;
        return looksLikeKeyRejection(err.getStatusCode().value(), err.getResponseBodyAsString());
    }

    /**
     * Nhà cung cấp trả 401/403 khi khóa sai hoặc hết hạn; riêng Gemini báo khóa sai bằng 400 kèm
     * {@code API_KEY_INVALID} trong body. Phân biệt với 429/5xx để còn dùng được nhánh dự phòng.
     */
    static boolean looksLikeKeyRejection(int status, String body) {
        if (status == 401 || status == 403) return true;
        if (body == null || body.isEmpty()) return false;
        return body.contains("API_KEY_INVALID")
                || body.contains("API key not valid")
                || body.contains("invalid_api_key")
                || body.contains("Incorrect API key");
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

    /** Создает vector embedding cho tung doan; tra [] khi chua cau hinh khoa. */
    public float[] embed(String text) {
        String provider = setting("provider", props.getAi().getProvider()).toLowerCase();
        String model = props.getAi().getEmbeddingModel();
        int dims = props.getAi().getEmbeddingDimensions();
        String apiKey = props.getAi().getApiKey();
        if (apiKey == null || apiKey.isBlank() || text == null || text.isBlank()) {
            return new float[0];
        }
        try {
            String raw = PROVIDER_OPENAI.equals(provider)
                    ? callOpenAIEmbed(apiKey, model, text)
                    : callGeminiEmbed(apiKey, model, text, dims);
            return parseEmbed(provider, raw, dims);
        } catch (Exception e) {
            if (isKeyRejected(e)) {
                credentialsRejected = true;
                throw new AiKeyRejectedException("Khóa API của dịch vụ AI bị từ chối", e);
            }
            // Lỗi tạm thời thì tra về rỗng để retrieve roi sang keyword, không lam hong luot chat.
            return new float[0];
        }
    }

    private String callGeminiEmbed(String apiKey, String model, String text, int dims) {
        Map<String, Object> body = Map.of(
                "content", Map.of("parts", List.of(Map.of("text", text))),
                "taskType", "RETRIEVAL_DOCUMENT",
                "outputDimensionality", dims);
        return http.post().uri(GEMINI_URL + model + ":embedContent?key=" + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private String callOpenAIEmbed(String apiKey, String model, String text) {
        Map<String, Object> body = Map.of("model", model, "input", text);
        return http.post().uri("https://api.openai.com/v1/embeddings")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private float[] parseEmbed(String provider, String raw, int dims) throws Exception {
        JsonNode root = mapper.readTree(raw);
        JsonNode vec;
        if (PROVIDER_OPENAI.equals(provider)) {
            vec = root.path("data").path(0).path("embedding");
        } else {
            vec = root.path("embedding").path("values");
        }
        float[] out = new float[dims];
        for (int i = 0; i < dims && i < vec.size(); i++) out[i] = (float) vec.get(i).asDouble();
        return out;
    }

    /** Chuyen float[] sang vector literal "[0.1,0.2,...]" de luu Postgres. */
    public static String toVectorLiteral(float[] v) {
        if (v == null || v.length == 0) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(v[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    /** Nghi tra vector literal ve cosine trong Java khi DB chua co extension. */
    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length == 0 || b.length == 0 || a.length != b.length) return -1;
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        if (na == 0 || nb == 0) return -1;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    public static float[] parseVectorLiteral(String s) {
        if (s == null || s.isBlank()) return new float[0];
        String t = s.trim().replace("[", "").replace("]", "");
        if (t.isEmpty()) return new float[0];
        String[] parts = t.split(",");
        float[] out = new float[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Float.parseFloat(parts[i].trim());
        return out;
    }
}