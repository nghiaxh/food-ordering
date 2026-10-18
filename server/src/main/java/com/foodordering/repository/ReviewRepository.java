package com.foodordering.repository;

import com.foodordering.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    long countByUserId(Long userId);
    List<Review> findByFoodIdOrderByCreatedAtDesc(Long foodId);
}