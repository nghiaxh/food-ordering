package com.foodordering.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    private String fullName;
    private String phone;
    private String address;

    @Enumerated(EnumType.STRING)
    private Role role = Role.CUSTOMER;

    private boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Role { CUSTOMER, ADMIN }
}