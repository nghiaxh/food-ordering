package com.foodordering.service;

import com.foodordering.dto.FoodDtos.FoodRequest;
import com.foodordering.entity.Food;
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

    public FoodService(FoodRepository foodRepo, CategoryRepository categoryRepo) {
        this.foodRepo = foodRepo;
        this.categoryRepo = categoryRepo;
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

    public void delete(Long id) {
        foodRepo.deleteById(id);
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