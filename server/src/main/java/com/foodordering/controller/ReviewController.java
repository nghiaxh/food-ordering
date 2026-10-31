package com.foodordering.controller;

import com.foodordering.dto.ReviewDtos.*;
import com.foodordering.entity.Orders;
import com.foodordering.entity.Review;
import com.foodordering.entity.User;
import com.foodordering.repository.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {
    private final ReviewRepository reviewRepo;
    private final UserRepository userRepo;
    private final FoodRepository foodRepo;
    private final OrdersRepository orderRepo;

    public ReviewController(ReviewRepository reviewRepo, UserRepository userRepo, FoodRepository foodRepo,
                            OrdersRepository orderRepo) {
        this.reviewRepo = reviewRepo;
        this.userRepo = userRepo;
        this.foodRepo = foodRepo;
        this.orderRepo = orderRepo;
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
        User user = userRepo.findByEmail(auth.getName()).orElseThrow();
        boolean ordered = orderRepo.existsByUserIdAndStatusAndItemsFoodId(
                user.getId(), Orders.Status.COMPLETED, req.foodId());
        if (!ordered) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Bạn chỉ có thể đánh giá món đã dùng trong đơn hàng hoàn thành");
        }
        Review r = new Review();
        r.setUser(user);
        r.setFood(foodRepo.findById(req.foodId()).orElseThrow());
        r.setRating(req.rating());
        r.setComment(req.comment());
        reviewRepo.save(r);
        return new ReviewResponse(r.getId(), r.getUser().getFullName(), r.getRating(),
                r.getComment(), r.getCreatedAt().toString());
    }
}