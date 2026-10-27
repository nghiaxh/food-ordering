package com.foodordering.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Getter @Setter @NoArgsConstructor
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(optional = false)
    private Orders order;

    @ManyToOne(optional = true)
    private Food food;

    @ManyToOne(optional = true)
    private Combo combo;

    private int quantity;
    private BigDecimal price;
    /** Số tiền giảm giá cho dòng này (khuyến mãi tự động). */
    private BigDecimal discountAmount = BigDecimal.ZERO;
}