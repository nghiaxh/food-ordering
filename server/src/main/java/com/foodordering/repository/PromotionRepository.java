package com.foodordering.repository;

import com.foodordering.entity.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
    List<Promotion> findByActiveTrue();
    Optional<Promotion> findByCodeIgnoreCase(String code);
    List<Promotion> findByScopeAndActiveTrue(Promotion.Scope scope);
}