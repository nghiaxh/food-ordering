package com.foodordering.controller;

import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.repository.CategoryRepository;
import com.foodordering.service.FoodService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api")
public class FoodController {
    private final FoodService foodService;
    private final CategoryRepository categoryRepo;

    public FoodController(FoodService foodService, CategoryRepository categoryRepo) {
        this.foodService = foodService;
        this.categoryRepo = categoryRepo;
    }

    @GetMapping("/categories")
    public List<Category> categories() {
        return categoryRepo.findAll();
    }

    @GetMapping("/foods")
    public List<Food> search(@RequestParam(required = false) String keyword,
                             @RequestParam(required = false) Long categoryId,
                             @RequestParam(required = false) BigDecimal minPrice,
                             @RequestParam(required = false) BigDecimal maxPrice) {
        return foodService.search(keyword, categoryId, minPrice, maxPrice, false);
    }

    @GetMapping("/foods/{id}")
    public Food detail(@PathVariable Long id) {
        return foodService.getById(id);
    }
}