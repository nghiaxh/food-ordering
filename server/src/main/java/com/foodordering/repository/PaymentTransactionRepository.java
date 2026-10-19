package com.foodordering.repository;

import com.foodordering.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Optional<PaymentTransaction> findByOrderId(Long orderId);

    /** Xoá giao dịch của đơn khi đơn bị xoá, vì giao dịch giữ khoá ngoại tới đơn. */
    void deleteByOrderId(Long orderId);
}
