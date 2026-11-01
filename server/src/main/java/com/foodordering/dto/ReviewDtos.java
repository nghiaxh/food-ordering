package com.foodordering.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ReviewDtos {
    public record ReviewRequest(@NotNull Long foodId, @Min(1) @Max(5) int rating, String comment) {}

    /** Sửa đánh giá không đổi món, nên không cần gửi lại foodId. */
    public record UpdateReviewRequest(@Min(1) @Max(5) int rating, String comment) {}

    /** mine cho phép client biết đánh giá nào của chính mình để hiện nút Sửa/Xóa. */
    public record ReviewResponse(Long id, String userName, int rating, String comment, String createdAt, boolean mine) {}
}