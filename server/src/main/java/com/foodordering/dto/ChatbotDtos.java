package com.foodordering.dto;

import com.foodordering.entity.Food;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class ChatbotDtos {
    public record ChatRequest(@NotBlank String message, String sessionId) {}

    public record FoodCard(Long id, String name, String price, String imageUrl, String categoryName) {
        public static FoodCard from(Food f) {
            return new FoodCard(f.getId(), f.getName(), f.getPrice().toPlainString(),
                    f.getImageUrl(), f.getCategory() != null ? f.getCategory().getName() : null);
        }
    }

    public record ChatResponse(String reply, List<FoodCard> foods) {}

    public record Criteria(
            String category,
            Integer maxSpicyLevel,
            Long maxBudget,
            Integer people,
            List<String> excludeAllergens,
            List<String> dietaryTags,
            List<String> keywords) {}
}