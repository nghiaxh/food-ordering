package com.foodordering.repository;

import com.foodordering.entity.UserVoucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserVoucherRepository extends JpaRepository<UserVoucher, Long> {
    List<UserVoucher> findByUserIdOrderByClaimedAtDesc(Long userId);
    Optional<UserVoucher> findByUserIdAndPromotionId(Long userId, Long promotionId);
    boolean existsByUserIdAndPromotionId(Long userId, Long promotionId);
}
