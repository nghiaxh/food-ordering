package com.foodordering.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Mọi phép tính khuyến mãi nhận {@link Clock} thay vì gọi LocalDateTime.now() trực tiếp,
 * nhờ vậy test kiểm được "thứ bảy", "qua ngày mới" mà không phải đợi thời gian thật.
 */
@Configuration
public class TimeConfig {
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
