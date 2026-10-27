package com.foodordering.dto;

import java.math.BigDecimal;
import java.util.List;

public class ReportDtos {
    public record SummaryResponse(BigDecimal revenue, long orderCount, long completedCount,
                                 BigDecimal avgOrder, long customerCount, long promotionUsage,
                                 BigDecimal promotionDiscount) {}
    public record RevenuePoint(String date, BigDecimal revenue, long orders) {}
    public record TopFood(String name, long quantity, BigDecimal revenue) {}
    public record PromotionUsage(String code, String name, long usage, BigDecimal discount) {}
    public record ComboSales(String name, long quantity, BigDecimal revenue) {}
    public record ReportBundle(SummaryResponse summary, List<RevenuePoint> revenue,
                               List<TopFood> topFoods, List<PromotionUsage> promotions,
                               List<ComboSales> combos) {}
}