package com.foodordering.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import lombok.Getter;
import lombok.Setter;

@Component
@ConfigurationProperties(prefix = "app")
@Getter @Setter
public class AppProperties {
    private Jwt jwt = new Jwt();
    private Ai ai = new Ai();

    @Getter @Setter
    public static class Jwt {
        private String secret;
        private long expirationMs;
    }

    @Getter @Setter
    public static class Ai {
        private String apiKey;
        /** Mặc định khi quản trị viên chưa chọn nhà cung cấp trong trang Chatbot. */
        private String provider = "gemini";
        private String model;
    }
}