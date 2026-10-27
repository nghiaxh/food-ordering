package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Getter @Setter @NoArgsConstructor
public class Food {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    private Category category;

    @Column(length = 1000)
    private String description;

    @Column(length = 1000)
    private String ingredients;

    @Column(nullable = false)
    private BigDecimal price;

    private String imageUrl;

    private int servingSize = 1;

    private int spicyLevel = 0;

    private String dietaryTags;

    private String allergens;

    private boolean available = true;

    /*
     * Bốn trường dưới đây không lưu vào database. Chúng được PricingService điền lúc đọc
     * để client hiện giá đã giảm và nhãn ưu đãi mà không phải tự tính phần trăm.
     * `price` vẫn là giá gốc, cũng là giá chụp vào dòng đơn.
     */
    @Transient
    private java.math.BigDecimal discountedPrice;

    @Transient
    private java.math.BigDecimal discountAmount;

    @Transient
    private Integer discountPercent;

    @Transient
    private String discountLabel;
}