package com.foodordering.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor
public class AiSetting {
    @Id
    private String settingKey;

    @Column(columnDefinition = "TEXT")
    private String settingValue;
}