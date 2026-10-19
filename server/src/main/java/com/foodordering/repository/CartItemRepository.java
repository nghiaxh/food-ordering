package com.foodordering.repository;

import com.foodordering.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByUserIdOrderByIdAsc(Long userId);
    Optional<CartItem> findByUserIdAndFoodId(Long userId, Long foodId);
    void deleteByUserId(Long userId);

    /** Món còn nằm trong giỏ của khách thì chưa xoá được, phải chuyển sang ngừng phục vụ. */
    boolean existsByFoodId(Long foodId);
}
