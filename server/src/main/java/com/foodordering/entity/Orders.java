package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor
public class Orders {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User user;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    private String paymentMethod;
    private BigDecimal total;
    /** Tổng tiền giảm giá áp dụng cho đơn (khuyến mãi/voucher). */
    private BigDecimal discountTotal = BigDecimal.ZERO;
    /** Mã khuyến mãi/voucher đã áp dụng, null nếu không dùng. */
    private String promotionCode;
    private String receiverName;
    private String phone;
    private String address;
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<OrderItem> items = new ArrayList<>();

    public enum Status { PENDING, CONFIRMED, PREPARING, COMPLETED, CANCELLED }
}