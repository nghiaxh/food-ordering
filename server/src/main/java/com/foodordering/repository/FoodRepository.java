package com.foodordering.repository;

import com.foodordering.entity.Food;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;

public interface FoodRepository extends JpaRepository<Food, Long>, JpaSpecificationExecutor<Food> {
    List<Food> findAllByAvailableTrue();
}