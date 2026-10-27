package com.foodordering.service;

import com.foodordering.dto.QuoteDtos.CartQuote;
import com.foodordering.entity.CartItem;
import com.foodordering.entity.Combo;
import com.foodordering.entity.Food;
import com.foodordering.entity.User;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.ComboRepository;
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
    private final ComboRepository comboRepo;
    private final UserRepository userRepo;
    private final PricingService pricing;
 
    public CartService(CartItemRepository itemRepo, FoodRepository foodRepo, ComboRepository comboRepo,
                       UserRepository userRepo, PricingService pricing) {
        this.itemRepo = itemRepo;
        this.foodRepo = foodRepo;
        this.comboRepo = comboRepo;
        this.userRepo = userRepo;
        this.pricing = pricing;
    }

    public List<CartItem> list(String email) {
        User user = userRepo.findByEmail(email).orElseThrow();
        return itemRepo.findByUserIdOrderByIdAsc(user.getId());
    }

    /**
     * Báo giá giỏ hàng. Client không tự tính giảm giá nữa; mọi con số hiển thị ở đây đều
     * do server tính và cũng chính là con số dùng lúc tạo đơn.
     */
    public CartQuote quote(String email, String voucherCode) {
        User user = userRepo.findByEmail(email).orElseThrow();
        return pricing.toQuote(pricing.priceCart(
                itemRepo.findByUserIdOrderByIdAsc(user.getId()), user, voucherCode));
    }

    @Transactional
    public CartItem add(String email, Long foodId, int quantity) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Food food = foodRepo.findById(foodId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
        // Món ngừng phục vụ không được đưa vào giỏ; nếu không thì đơn chỉ chặn được lúc đặt.
        if (!food.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món \"" + food.getName() + "\" hiện không phục vụ");
        }
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
    public CartItem addCombo(String email, Long comboId, int quantity) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Combo combo = comboRepo.findById(comboId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Combo không tồn tại"));
        if (!combo.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Combo \"" + combo.getName() + "\" hiện không phục vụ");
        }
        CartItem item = itemRepo.findByUserIdAndComboId(user.getId(), comboId).orElseGet(() -> {
            CartItem created = new CartItem();
            created.setUser(user);
            created.setCombo(combo);
            return created;
        });
        item.setQuantity(item.getQuantity() + quantity);
        return itemRepo.save(item);
    }

    @Transactional
    public CartItem updateComboQuantity(String email, Long comboId, int quantity) {
        User user = userRepo.findByEmail(email).orElseThrow();
        CartItem item = itemRepo.findByUserIdAndComboId(user.getId(), comboId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Combo chưa có trong giỏ hàng"));
        item.setQuantity(quantity);
        return itemRepo.save(item);
    }

    @Transactional
    public void removeCombo(String email, Long comboId) {
        User user = userRepo.findByEmail(email).orElseThrow();
        CartItem item = itemRepo.findByUserIdAndComboId(user.getId(), comboId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Combo chưa có trong giỏ hàng"));
        itemRepo.delete(item);
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
