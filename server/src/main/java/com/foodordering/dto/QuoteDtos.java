package com.foodordering.dto;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Báo giá cho giỏ hàng. Đây là nguồn sự thật duy nhất về tiền: client chỉ hiển thị lại,
 * không tự nhân chia phần trăm hay trừ khuyến mãi. Khi tạo đơn, server tính lại bằng đúng
 * hàm này nên số khách thấy và số ghi vào đơn không thể lệch nhau.
 */
public class QuoteDtos {
    /**
     * Danh sách dòng client đang hiển thị. Quote tính trên chính danh sách này thay vì đọc
     * lại giỏ trong DB, nhờ vậy thêm món xong không bị response cũ của giỏ ghi đè.
     */
    public record QuoteRequest(@Valid @NotEmpty List<OrderItemRequest> items) {}

    /** Một dòng hàng. Giảm giá là số tiền của cả dòng, khớp với OrderItem.discountAmount. */
    public record QuoteLine(
            Long foodId,
            String name,
            String imageUrl,
            BigDecimal unitPrice,
            BigDecimal lineDiscount,
            int quantity,
            BigDecimal lineTotal,
            String discountLabel) {}

    public record CartQuote(
            List<QuoteLine> lines,
            BigDecimal subtotal,
            BigDecimal discountTotal,
            BigDecimal total) {}
}
