package com.foodordering.service;

import com.foodordering.entity.CartItem;
import com.foodordering.entity.Food;
import com.foodordering.entity.User;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class CartService {
    private final CartItemRepository itemRepo;
    private final FoodRepository foodRepo;
    private final UserRepository userRepo;

    public CartService(CartItemRepository itemRepo, FoodRepository foodRepo, UserRepository userRepo) {
        this.itemRepo = itemRepo;
        this.foodRepo = foodRepo;
        this.userRepo = userRepo;
    }

    public List<CartItem> list(String email) {
        User user = userRepo.findByEmail(email).orElseThrow();
        return itemRepo.findByUserIdOrderByIdAsc(user.getId());
    }

    @Transactional
    public CartItem add(String email, Long foodId, int quantity) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Food food = foodRepo.findById(foodId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
        CartItem item = itemRepo.findByUserIdAndFoodId(user.getId(), foodId).orElseGet(() -> {
            CartItem created = new CartItem();
            created.setUser(user);
            created.setFood(food);
            return created;
        });
        item.setQuantity(item.getQuantity() + quantity);
        return itemRepo.save(item);
    }

    @Transactional
    public CartItem updateQuantity(String email, Long foodId, int quantity) {
        User user = userRepo.findByEmail(email).orElseThrow();
        CartItem item = itemRepo.findByUserIdAndFoodId(user.getId(), foodId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Món chưa có trong giỏ hàng"));
        item.setQuantity(quantity);
        return itemRepo.save(item);
    }

    @Transactional
    public void remove(String email, Long foodId) {
        User user = userRepo.findByEmail(email).orElseThrow();
        CartItem item = itemRepo.findByUserIdAndFoodId(user.getId(), foodId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Món chưa có trong giỏ hàng"));
        itemRepo.delete(item);
    }

    @Transactional
    public void clear(String email) {
        User user = userRepo.findByEmail(email).orElseThrow();
        itemRepo.deleteByUserId(user.getId());
    }
}
