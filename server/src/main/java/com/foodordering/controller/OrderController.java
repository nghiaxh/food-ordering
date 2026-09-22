package com.foodordering.controller;

import com.foodordering.dto.OrderDtos.CreateOrderRequest;
import com.foodordering.entity.Orders;
import com.foodordering.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public Orders create(Authentication auth, @Valid @RequestBody CreateOrderRequest req) {
        return orderService.create(auth.getName(), req);
    }

    @GetMapping("/my")
    public List<Orders> myOrders(Authentication auth) {
        return orderService.myOrders(auth.getName());
    }
}