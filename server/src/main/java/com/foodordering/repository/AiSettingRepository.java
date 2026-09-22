package com.foodordering.repository;

import com.foodordering.entity.AiSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiSettingRepository extends JpaRepository<AiSetting, String> {
}