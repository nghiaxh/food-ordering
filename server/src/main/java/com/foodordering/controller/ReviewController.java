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
    public List<ReviewResponse> byFood(Authentication auth, @PathVariable Long foodId) {
        Long me = auth != null && auth.isAuthenticated() ? currentUser(auth).getId() : null;
        return reviewRepo.findByFoodIdOrderByCreatedAtDesc(foodId).stream()
                .map(r -> toResponse(r, me))
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
        return toResponse(r, user.getId());
    }

    @PutMapping("/{id}")
    public ReviewResponse update(Authentication auth, @PathVariable Long id, @Valid @RequestBody UpdateReviewRequest req) {
        Review r = ownReview(auth, id);
        r.setRating(req.rating());
        r.setComment(req.comment());
        reviewRepo.save(r);
        return toResponse(r, r.getUser().getId());
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        reviewRepo.delete(ownReview(auth, id));
    }

    /** Sửa hay xóa cũng chỉ áp dụng cho đánh giá của chính người đang đăng nhập. */
    private Review ownReview(Authentication auth, Long id) {
        User user = userRepo.findByEmail(auth.getName()).orElseThrow();
        Review r = reviewRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá"));
        if (!r.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chỉ có thể sửa hoặc xóa đánh giá của mình");
        }
        return r;
    }

    private ReviewResponse toResponse(Review r, Long currentUserId) {
        return new ReviewResponse(r.getId(), r.getUser().getFullName(), r.getRating(),
                r.getComment(), r.getCreatedAt().toString(),
                currentUserId != null && currentUserId.equals(r.getUser().getId()));
    }

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userRepo.findByEmail(auth.getName()).orElse(null);
    }
}