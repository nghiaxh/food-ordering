package com.foodordering.controller;

import com.foodordering.dto.NotificationDtos.NotificationResponse;
import com.foodordering.entity.Notification;
import com.foodordering.entity.User;
import com.foodordering.repository.NotificationRepository;
import com.foodordering.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationRepository notificationRepo;
    private final UserRepository userRepo;

    public NotificationController(NotificationRepository notificationRepo, UserRepository userRepo) {
        this.notificationRepo = notificationRepo;
        this.userRepo = userRepo;
    }

    @GetMapping
    public List<NotificationResponse> mine(Authentication auth) {
        return notificationRepo.findByUserIdOrderByCreatedAtDesc(currentUser(auth).getId()).stream()
                .map(NotificationController::toResponse)
                .toList();
    }

    @PostMapping("/read-all")
    @Transactional
    public void readAll(Authentication auth) {
        List<Notification> unread = notificationRepo.findByUserIdAndReadFalse(currentUser(auth).getId());
        unread.forEach(n -> n.setRead(true));
        notificationRepo.saveAll(unread);
    }

    @DeleteMapping("/read")
    @Transactional
    public void deleteRead(Authentication auth) {
        notificationRepo.deleteByUserIdAndReadTrue(currentUser(auth).getId());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteOne(@PathVariable Long id, Authentication auth) {
        User user = currentUser(auth);
        Notification notification = notificationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo"));
        if (!notification.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xoá thông báo này");
        }
        notificationRepo.delete(notification);
    }

    private User currentUser(Authentication auth) {
        return userRepo.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
    }

    private static NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(n.getId(), n.getContent(), n.isRead(), n.getCreatedAt().toString());
    }
}
