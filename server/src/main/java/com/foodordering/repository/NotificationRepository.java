package com.foodordering.repository;

import com.foodordering.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    long countByUserId(Long userId);
    void deleteByUserId(Long userId);
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findByUserIdAndReadFalse(Long userId);
    long countByUserIdAndReadFalse(Long userId);
}
