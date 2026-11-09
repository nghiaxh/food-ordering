package com.foodordering.dto;

import com.foodordering.entity.Food;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class ChatbotDtos {
    /**
     * {@code history} là vài câu hỏi gần nhất của khách, {@code lastFoodIds} là ID các món vừa
     * gợi ý ở lượt trước. Client gửi kèm để khách vãng lai vẫn hỏi tiếp được ("món đó cay
     * không") mà server không phải lưu ngữ cảnh vào CSDL. Cả hai đều không bắt buộc.
     */
    public record ChatRequest(@NotBlank String message, String sessionId,
                              List<String> history, List<Long> lastFoodIds) {}

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

    /**
     * Nguồn trích dẫn khi bot tra tài liệu quán. Client hiện "Nguồn: ..." dưới câu trả lời
     * để khách biết thông tin từ đâu, AI không tự bịa nguồn.
     */
    public record Citation(String sourceName, String snippet) {}

    /**
     * Intent của câu hỏi: FOOD gợi ý món, RESTAURANT_INFO thông tin quán, ORDER_GUIDE hướng
     * dẫn đặt/hủy đơn, OUT_OF_SCOPE ngoài lề. Client dùng để đổi placeholder/chip cho đúng.
     */
    public record ChatResponse(String reply, List<FoodCard> foods, String intent, List<Citation> citations) {
        public ChatResponse(String reply, List<FoodCard> foods) {
            this(reply, foods, null, null);
        }
    }

    /**
     * Trạng thái sẵn dùng của trợ lý. {@code notice} là câu hiện cho khách khi thiếu khóa API;
     * endpoint chỉ trả boolean và câu thông báo, không bao giờ trả giá trị khóa.
     */
    public record ChatbotStatus(boolean available, String notice) {}

    /** Tài liệu quản trị: tiêu đề, nhóm, từ khóa, nội dung, trạng thái, file gốc. */
    public record KnowledgeDoc(Long id, String title, String category, String keywords, String content, boolean enabled,
                               String status, String fileName, Long fileSize, long chunkCount) {
        public KnowledgeDoc(Long id, String title, String category, String keywords, String content, boolean enabled) {
            this(id, title, category, keywords, content, enabled, "READY", null, null, 0);
        }
    }

    /** Dữ liệu biểu mẫu thêm/sửa tài liệu. */
    public record KnowledgeRequest(
            @NotBlank String title,
            String category,
            String keywords,
            @NotBlank String content,
            boolean enabled) {}

    /** Một đoạn văn bản sau khi chia nhỏ, kèm vector. */
    public record ChunkView(Long id, int chunkIndex, String content) {}

    /** Thống kê tài liệu RAG. */
    public record DocStats(long totalDocuments, long totalChunks, long ready, long failed) {}

    /** Phản hồi của khách trên tin bot: rating là up | down. */
    public record FeedbackRequest(String sessionId, Integer messageIndex, String rating) {}

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