package com.foodordering.controller;

import com.foodordering.dto.CartDtos.*;
import com.foodordering.dto.QuoteDtos.CartQuote;
import com.foodordering.dto.QuoteDtos.QuoteRequest;
import com.foodordering.entity.CartItem;
import com.foodordering.service.CartService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cart")
public class CartController {
    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public List<CartItem> list(Authentication auth) {
        return cartService.list(auth.getName());
    }

    @PostMapping("/items")
    public CartItem add(Authentication auth, @Valid @RequestBody AddItemRequest req) {
        return cartService.add(auth.getName(), req.foodId(), req.quantity());
    }

    @PatchMapping("/items/{foodId}")
    public CartItem updateQuantity(Authentication auth, @PathVariable Long foodId,
                                   @Valid @RequestBody UpdateQuantityRequest req) {
        return cartService.updateQuantity(auth.getName(), foodId, req.quantity());
    }

    @DeleteMapping("/items/{foodId}")
    public void remove(Authentication auth, @PathVariable Long foodId) {
        cartService.remove(auth.getName(), foodId);
    }

    @PostMapping("/combos")
    public CartItem addCombo(Authentication auth, @Valid @RequestBody AddComboRequest req) {
        return cartService.addCombo(auth.getName(), req.comboId(), req.quantity());
    }

    @PatchMapping("/combos/{comboId}")
    public CartItem updateComboQuantity(Authentication auth, @PathVariable Long comboId,
                                       @Valid @RequestBody UpdateQuantityRequest req) {
        return cartService.updateComboQuantity(auth.getName(), comboId, req.quantity());
    }

    @DeleteMapping("/combos/{comboId}")
    public void removeCombo(Authentication auth, @PathVariable Long comboId) {
        cartService.removeCombo(auth.getName(), comboId);
    }

    @DeleteMapping
    public void clear(Authentication auth) {
        cartService.clear(auth.getName());
    }

    /** Trả báo giá kèm giảm giá từng dòng; mã voucher sai thì trả lỗi 400 kèm lý do. */
    @PostMapping("/quote")
    public CartQuote quote(Authentication auth, @RequestBody(required = false) QuoteRequest req) {
        return cartService.quote(auth.getName(), req == null ? null : req.voucherCode());
    }
}
