package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter @NoArgsConstructor
public class Promotion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType discountType = DiscountType.PERCENT;

    @Column(nullable = false)
    private BigDecimal discountValue;

    private BigDecimal maxDiscount;
    private BigDecimal minOrderTotal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Scope scope = Scope.GLOBAL;

    @ElementCollection
    @CollectionTable(name = "promotion_targets", joinColumns = @JoinColumn(name = "promotion_id"))
    @Column(name = "target_id")
    private List<Long> targetIds = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime startsAt;

    @Column(nullable = false)
    private LocalDateTime endsAt;

    /** Danh sách ngày trong tuần áp dụng, phân tách bằng dấu phẩy, ví dụ MON,TUE. Null = mọi ngày. */
    private String daysOfWeek;

    private LocalTime startTime;
    private LocalTime endTime;

    private boolean active = true;

    private int priority = 0;

    private Integer usageLimit;
    private int usedCount = 0;

    /**
     * Số món ngẫu nhiên được giảm mỗi ngày. Chỉ dùng cho khuyến mãi toàn thực đơn (scope GLOBAL).
     * 0 nghĩa là áp cho mọi món khớp phạm vi. Món được chọn bằng băm ổn định theo
     * (món, khuyến mãi, ngày) nên trong cùng một ngày mọi request ra cùng kết quả,
     * sang ngày mới tự đổi mà không cần scheduler.
     */
    private int randomCount = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public enum DiscountType { PERCENT, FIXED }
    public enum Scope { GLOBAL, CATEGORY, FOOD }
}