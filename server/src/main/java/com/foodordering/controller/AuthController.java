package com.foodordering.controller;

import com.foodordering.dto.AuthDtos.*;
import com.foodordering.entity.User;
import com.foodordering.repository.UserRepository;
import com.foodordering.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final UserRepository userRepo;

    public AuthController(AuthService authService, UserRepository userRepo) {
        this.authService = authService;
        this.userRepo = userRepo;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        return authService.register(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public User me(Authentication auth) {
        return userRepo.findByEmail(auth.getName()).orElseThrow();
    }

    @PutMapping("/me")
    public User updateMe(Authentication auth, @Valid @RequestBody UpdateProfileRequest req) {
        User u = userRepo.findByEmail(auth.getName()).orElseThrow();
        u.setFullName(req.fullName());
        u.setPhone(req.phone());
        u.setAddress(req.address());
        return userRepo.save(u);
    }

    @PutMapping("/password")
    public void changePassword(Authentication auth, @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(auth.getName(), req);
    }
}