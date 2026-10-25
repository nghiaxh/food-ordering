package com.foodordering.service;

import com.foodordering.dto.FoodDtos.FoodRequest;
import com.foodordering.entity.Food;
import com.foodordering.repository.CartItemRepository;
import com.foodordering.repository.OrdersRepository;
import com.foodordering.repository.CategoryRepository;
import com.foodordering.repository.FoodRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class FoodService {
    private final FoodRepository foodRepo;
    private final CategoryRepository categoryRepo;
    private final OrdersRepository orderRepo;
    private final CartItemRepository cartItemRepo;

    public FoodService(FoodRepository foodRepo, CategoryRepository categoryRepo,
                       OrdersRepository orderRepo, CartItemRepository cartItemRepo) {
        this.foodRepo = foodRepo;
        this.categoryRepo = categoryRepo;
        this.orderRepo = orderRepo;
        this.cartItemRepo = cartItemRepo;
    }

    public List<Food> search(String keyword, Long categoryId, BigDecimal minPrice,
                             BigDecimal maxPrice, boolean onlyAvailable) {
        Specification<Food> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                ps.add(cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%"));
            }
            if (categoryId != null) ps.add(cb.equal(root.get("category").get("id"), categoryId));
            if (minPrice != null) ps.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            if (maxPrice != null) ps.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            if (onlyAvailable) ps.add(cb.isTrue(root.get("available")));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return foodRepo.findAll(spec);
    }

    public Food getById(Long id) {
        return foodRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy món ăn"));
    }

    public Food create(FoodRequest req) {
        return foodRepo.save(apply(new Food(), req));
    }

    public Food update(Long id, FoodRequest req) {
        return foodRepo.save(apply(getById(id), req));
    }

    /**
     * Món đã phát sinh đơn không xoá vật lý được, vì chi tiết đơn còn tham chiếu tới nó; admin phải
     * chuyển sang trạng thái ngừng phục vụ để giữ nguyên lịch sử đơn hàng. Món còn nằm trong giỏ
     * của khách cũng vậy, vì dòng giỏ giữ khoá ngoại tới món.
     */
    public void delete(Long id) {
        Food food = getById(id);
        if (orderRepo.existsByItemsFoodId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Món \"" + food.getName() + "\" đang nằm trong đơn hàng. Hãy chuyển sang trạng thái ngừng phục vụ.");
        }
        if (cartItemRepo.existsByFoodId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Món \"" + food.getName() + "\" đang nằm trong giỏ hàng của khách. Hãy chuyển sang trạng thái ngừng phục vụ.");
        }
        foodRepo.delete(food);
    }

    private Food apply(Food f, FoodRequest r) {
        f.setName(r.name());
        f.setCategory(categoryRepo.findById(r.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh mục không tồn tại")));
        f.setDescription(r.description());
        f.setIngredients(r.ingredients());
        f.setPrice(r.price());
        f.setImageUrl(r.imageUrl());
        f.setServingSize(r.servingSize() <= 0 ? 1 : r.servingSize());
        f.setSpicyLevel(r.spicyLevel());
        f.setDietaryTags(r.dietaryTags());
        f.setAllergens(r.allergens());
        f.setAvailable(r.available());
        return f;
    }
}