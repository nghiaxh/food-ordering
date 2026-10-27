package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter @NoArgsConstructor
public class Combo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    private String imageUrl;

    @Column(nullable = false)
    private BigDecimal price;

    private boolean available = true;

    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "combo", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<ComboItem> items = new ArrayList<>();

    // Giống Food: bốn trường chỉ để hiển thị giá đã giảm, không lưu vào database.
    @Transient
    private BigDecimal discountedPrice;

    @Transient
    private BigDecimal discountAmount;

    @Transient
    private Integer discountPercent;

    @Transient
    private String discountLabel;
}