package com.foodordering.dto;

import com.foodordering.entity.Food;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class ChatbotDtos {
    public record ChatRequest(@NotBlank String message, String sessionId) {}

    /**
     * Thẻ món gợi ý. {@code portions} là số phần khách cần để đủ cho số người ăn, còn
     * {@code totalPrice} là tổng tiền của số phần đó. Cả hai chỉ có giá trị khác 1 khi khách
     * nói rõ số người; client hiển thị "xN" bên cạnh giá để giá trị khớp với tổng.
     */
    public record FoodCard(Long id, String name, String price, String imageUrl, String categoryName,
                           Integer portions, String totalPrice) {
        public static FoodCard from(Food f, int portions, long totalPrice) {
            return new FoodCard(f.getId(), f.getName(), f.getPrice().toPlainString(),
                    f.getImageUrl(), f.getCategory() != null ? f.getCategory().getName() : null,
                    portions, Long.toString(totalPrice));
        }
    }

    public record ChatResponse(String reply, List<FoodCard> foods) {}

    /**
     * Tiêu chí chatbot trích xuất từ câu hỏi.
     *
     * <p>{@code categories} là danh sách các loại món khách muốn kèm số món mong muốn cho mỗi
     * loại, dùng cho câu hỏi kiểu "một món chính và một món uống". {@code maxBudget} là TỔNG
     * ngân sách của cả bữa chứ không phải giá của từng món, nên khi ghép nhiều nhóm thì
     * tổng giá các món được chọn phải nằm trong hạn mức đó.
     */
    public record Criteria(
            List<CategoryNeed> categories,
            Integer maxSpicyLevel,
            Long maxBudget,
            Integer people,
            List<String> excludeAllergens,
            List<String> dietaryTags,
            List<String> keywords) {}

    /** Một loại món khách muốn và số món mong muốn cho loại đó. */
    public record CategoryNeed(String name, Integer count) {}
}