package com.foodordering.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "cart_items", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "food_id"}),
        @UniqueConstraint(columnNames = {"user_id", "combo_id"})
})
@Getter @Setter @NoArgsConstructor
public class CartItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(optional = false)
    private User user;

    @ManyToOne(optional = true)
    private Food food;

    @ManyToOne(optional = true)
    private Combo combo;

    private int quantity = 1;
}
