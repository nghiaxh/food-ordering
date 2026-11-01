package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/** Địa chỉ đã lưu của một người dùng; đơn hàng vẫn chụp riêng thông tin giao hàng khi đặt. */
@Entity
@Table(name = "user_addresses")
@Getter @Setter @NoArgsConstructor
public class UserAddress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User user;

    /** Nhãn do khách đặt (Nhà riêng, Cơ quan...), chỉ để hiển thị. */
    @Column(length = 50)
    private String label;

    @Column(nullable = false)
    private String receiverName;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String address;

    /** Mỗi user chỉ có một địa chỉ mặc định; được áp khi khách không chọn gì. */
    private boolean isDefault;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
