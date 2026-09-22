package com.foodordering.controller;

import com.foodordering.dto.ReviewDtos.*;
import com.foodordering.entity.Review;
import com.foodordering.repository.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {
    private final ReviewRepository reviewRepo;
    private final UserRepository userRepo;
    private final FoodRepository foodRepo;

    public ReviewController(ReviewRepository reviewRepo, UserRepository userRepo, FoodRepository foodRepo) {
        this.reviewRepo = reviewRepo;
        this.userRepo = userRepo;
        this.foodRepo = foodRepo;
    }

    @GetMapping("/food/{foodId}")
    public List<ReviewResponse> byFood(@PathVariable Long foodId) {
        return reviewRepo.findByFoodIdOrderByCreatedAtDesc(foodId).stream()
                .map(r -> new ReviewResponse(r.getId(), r.getUser().getFullName(), r.getRating(),
                        r.getComment(), r.getCreatedAt().toString()))
                .toList();
    }

    @PostMapping
    public ReviewResponse create(Authentication auth, @Valid @RequestBody ReviewRequest req) {
        Review r = new Review();
        r.setUser(userRepo.findByEmail(auth.getName()).orElseThrow());
        r.setFood(foodRepo.findById(req.foodId()).orElseThrow());
        r.setRating(req.rating());
        r.setComment(req.comment());
        reviewRepo.save(r);
        return new ReviewResponse(r.getId(), r.getUser().getFullName(), r.getRating(),
                r.getComment(), r.getCreatedAt().toString());
    }
}