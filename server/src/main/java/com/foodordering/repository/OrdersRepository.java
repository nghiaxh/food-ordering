package com.foodordering.repository;

import com.foodordering.entity.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrdersRepository extends JpaRepository<Orders, Long> {
    List<Orders> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Orders> findAllByOrderByCreatedAtDesc();
}