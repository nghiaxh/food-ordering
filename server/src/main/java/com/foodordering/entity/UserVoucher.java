package com.foodordering.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Voucher một khách đã nhận. Tách khỏi {@link Promotion} để biết ai đã nhận, đã dùng,
 * và chặn một người nhận quá số lượt mà admin đặt. Voucher nhận rồi vẫn phải còn hiệu lực
 * mới dùng được, nên mọi kiểm tra thời gian vẫn dựa trên promotion gốc.
 */
@Entity
@Table(name = "user_vouchers", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "promotion_id"})
})
@Getter @Setter @NoArgsConstructor
public class UserVoucher {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(optional = false)
    private User user;

    @ManyToOne(optional = false)
    private Promotion promotion;

    private LocalDateTime claimedAt = LocalDateTime.now();

    /**
     * Nguồn nhận: `WELCOME` (tặng khi đăng ký), `CLAIM` (khách tự nhận) hoặc `LUCKY` (quà
     * ngẫu nhiên). Cần phân biệt vì quà may mắn giới hạn một lần/ngày, còn voucher chào mừng
     * cấp cùng ngày không được tính là đã bốc quà.
     */
    private String source;

    /** Null nghĩa là đã nhận nhưng chưa dùng. */
    private LocalDateTime usedAt;
}
