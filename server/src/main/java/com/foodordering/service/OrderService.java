package com.foodordering.service;

import com.foodordering.dto.OrderDtos.*;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class OrderService {
    private final OrdersRepository orderRepo;
    private final FoodRepository foodRepo;
    private final UserRepository userRepo;

    public OrderService(OrdersRepository orderRepo, FoodRepository foodRepo, UserRepository userRepo) {
        this.orderRepo = orderRepo;
        this.foodRepo = foodRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public Orders create(String email, CreateOrderRequest req) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders order = new Orders();
        order.setUser(user);
        order.setReceiverName(req.receiverName());
        order.setPhone(req.phone());
        order.setAddress(req.address());
        order.setPaymentMethod(req.paymentMethod());

        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest it : req.items()) {
            Food food = foodRepo.findById(it.foodId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
            if (!food.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món \"" + food.getName() + "\" đã ngừng phục vụ");
            }
            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setFood(food);
            oi.setQuantity(it.quantity());
            oi.setPrice(food.getPrice());
            order.getItems().add(oi);
            total = total.add(food.getPrice().multiply(BigDecimal.valueOf(it.quantity())));
        }
        order.setTotal(total);
        return orderRepo.save(order);
    }

    public List<Orders> myOrders(String email) {
        User user = userRepo.findByEmail(email).orElseThrow();
        return orderRepo.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public List<Orders> all() {
        return orderRepo.findAllByOrderByCreatedAtDesc();
    }

    public Orders updateStatus(Long id, String status) {
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
        o.setStatus(Orders.Status.valueOf(status));
        return orderRepo.save(o);
    }
}