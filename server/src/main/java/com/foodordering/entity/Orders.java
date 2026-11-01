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

    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    private BigDecimal total;
    /** Tổng tiền giảm giá áp dụng cho đơn (khuyến mãi tự động theo dòng). */
    private BigDecimal discountTotal = BigDecimal.ZERO;
    private String receiverName;
    private String phone;
    private String address;
    /** Ghi chú của khách cho quán, tối đa 255 ký tự. */
    private String note;
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<OrderItem> items = new ArrayList<>();

    public enum Status { PENDING, CONFIRMED, PREPARING, COMPLETED, CANCELLED }

    public enum PaymentStatus { UNPAID, PAID }
}