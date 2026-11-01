package com.foodordering.repository;

import com.foodordering.entity.UserAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserAddressRepository extends JpaRepository<UserAddress, Long> {
    /** Mặc định đứng đầu để khách gọi lại dễ chọn. */
    List<UserAddress> findByUserIdOrderByIsDefaultDescCreatedAtAsc(Long userId);

    List<UserAddress> findByUserId(Long userId);

    java.util.Optional<UserAddress> findByUserIdAndIsDefaultTrue(Long userId);
}
