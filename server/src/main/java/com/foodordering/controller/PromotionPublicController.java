package com.foodordering.controller;

import com.foodordering.dto.PromotionDtos.VoucherValidateRequest;
import com.foodordering.dto.PromotionDtos.VoucherView;
import com.foodordering.entity.Promotion;
import com.foodordering.entity.User;
import com.foodordering.repository.UserRepository;
import com.foodordering.service.PromotionService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Phần khuyến mãi khách nhìn thấy. Danh sách voucher công khai phải mở cho khách vãng lai,
 * còn nhận quà và ví voucher thì cần đăng nhập vì gắn với tài khoản.
 */
@RestController
@RequestMapping("/api/promotions")
public class PromotionPublicController {
    private final PromotionService service;
    private final UserRepository userRepo;

    public PromotionPublicController(PromotionService service, UserRepository userRepo) {
        this.service = service;
        this.userRepo = userRepo;
    }

    @GetMapping("/active")
    public List<Promotion> active() {
        return service.activePromotions(LocalDateTime.now()).stream()
                .filter(p -> p.getCode() != null && !p.getCode().isBlank())
                .toList();
    }

    @PostMapping("/validate")
    public Promotion validate(@RequestBody VoucherValidateRequest req) {
        return service.validateVoucher(req.code(),
                req.subtotal() == null ? java.math.BigDecimal.ZERO : req.subtotal(),
                LocalDateTime.now());
    }

    @GetMapping("/claimable")
    public List<VoucherView> claimable(Authentication auth) {
        return service.claimable(optionalUser(auth), LocalDateTime.now());
    }

    @GetMapping("/mine")
    public List<VoucherView> mine(Authentication auth) {
        return service.mine(requiredUser(auth));
    }

    @PostMapping("/{id}/claim")
    public VoucherView claim(@PathVariable Long id, Authentication auth) {
        return service.claim(requiredUser(auth), id, LocalDateTime.now());
    }

    /** Quà ngẫu nhiên mỗi ngày, chặn bấm nhiều lần trong cùng ngày. */
    @PostMapping("/lucky")
    public VoucherView lucky(Authentication auth) {
        return service.lucky(requiredUser(auth), LocalDateTime.now());
    }

    private User optionalUser(Authentication auth) {
        return auth == null ? null : userRepo.findByEmail(auth.getName()).orElse(null);
    }

    private User requiredUser(Authentication auth) {
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        return userRepo.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
    }
}
