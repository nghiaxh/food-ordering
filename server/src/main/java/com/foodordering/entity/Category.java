package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor
public class Category {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    private String slug;

    private String imageUrl;

    /** Mô tả ngắn danh mục, hiển thị ở biểu mẫu quản trị và trang thực đơn. */
    private String description;
}