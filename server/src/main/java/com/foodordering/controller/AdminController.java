package com.foodordering.controller;

import com.foodordering.dto.FoodDtos.FoodRequest;
import com.foodordering.dto.OrderDtos.AdminOrderRequest;
import com.foodordering.dto.OrderDtos.UpdateStatusRequest;
import com.foodordering.dto.UserDtos.UserRequest;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.foodordering.service.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;

    private final FoodService foodService;
    private final OrderService orderService;
    private final AuthService authService;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;
    private final ChatMessageRepository chatRepo;
    private final KnowledgeDocumentRepository docRepo;
    private final KnowledgeService knowledgeService;
    private final AiSettingRepository settingRepo;
    private final Path uploadDir;

    public AdminController(FoodService foodService, OrderService orderService, AuthService authService,
                           CategoryRepository categoryRepo, UserRepository userRepo,
                           ChatMessageRepository chatRepo, KnowledgeDocumentRepository docRepo,
                           KnowledgeService knowledgeService, AiSettingRepository settingRepo,
                           @Value("${app.upload.dir:uploads}") String uploadDir) {
        this.foodService = foodService;
        this.orderService = orderService;
        this.authService = authService;
        this.categoryRepo = categoryRepo;
        this.userRepo = userRepo;
        this.chatRepo = chatRepo;
        this.docRepo = docRepo;
        this.knowledgeService = knowledgeService;
        this.settingRepo = settingRepo;
        this.uploadDir = Path.of(uploadDir);
    }

    // ----- Món ăn -----
    @PostMapping("/foods")
    public Food createFood(@Valid @RequestBody FoodRequest req) { return foodService.create(req); }

    @PutMapping("/foods/{id}")
    public Food updateFood(@PathVariable Long id, @Valid @RequestBody FoodRequest req) { return foodService.update(id, req); }

    @DeleteMapping("/foods/{id}")
    public void deleteFood(@PathVariable Long id) {
        // FoodService tự chặn món đã có trong đơn và trả về thông báo 409 rõ ràng.
        foodService.delete(id);
    }

    // ----- Danh mục -----
    @PostMapping("/categories")
    public Category createCategory(@RequestBody Category c) { return categoryRepo.save(c); }

    @PutMapping("/categories/{id}")
    public Category updateCategory(@PathVariable Long id, @RequestBody Category c) {
        c.setId(id);
        return categoryRepo.save(c);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable Long id) { categoryRepo.deleteById(id); }

    // ----- Đơn hàng -----
    @GetMapping("/orders")
    public List<Orders> orders() { return orderService.all(); }

    @PostMapping("/orders")
    public Orders createOrder(@Valid @RequestBody AdminOrderRequest req) { return orderService.adminCreate(req); }

    @PutMapping("/orders/{id}")
    public Orders updateOrder(@PathVariable Long id, @Valid @RequestBody AdminOrderRequest req) {
        return orderService.adminUpdate(id, req);
    }

    @DeleteMapping("/orders/{id}")
    public void deleteOrder(@PathVariable Long id) { orderService.adminDelete(id); }

    @PatchMapping("/orders/{id}/status")
    public Orders updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest req) {
        return orderService.updateStatus(id, req.status());
    }

    // ----- Khách hàng -----
    @GetMapping("/users")
    public List<User> users() { return userRepo.findAll(); }

    @PostMapping("/users")
    public User createUser(@Valid @RequestBody UserRequest req) { return authService.adminCreate(req); }

    @PutMapping("/users/{id}")
    public User updateUser(@PathVariable Long id, @Valid @RequestBody UserRequest req) {
        return authService.adminUpdate(id, req);
    }

    @DeleteMapping("/users/{id}")
    public void deleteUser(@PathVariable Long id) { authService.adminDelete(id); }

    @PatchMapping("/users/{id}/active")
    public User toggleActive(@PathVariable Long id, @RequestParam boolean active) {
        return authService.setActive(id, active);
    }

    // ----- Chatbot: lịch sử hội thoại -----
    @GetMapping("/chatbot/history")
    public List<ChatMessage> history() { return chatRepo.findAllByOrderByCreatedAtDesc(); }

    // ----- Chatbot: tài liệu tham khảo (RAG cơ bản) -----
    @GetMapping("/chatbot/documents")
    public List<KnowledgeDocument> documents() { return docRepo.findAll(); }

    @PostMapping("/chatbot/documents")
    public KnowledgeDocument upload(@RequestParam("file") MultipartFile file) throws Exception {
        return knowledgeService.upload(file);
    }

    @DeleteMapping("/chatbot/documents/{id}")
    public void deleteDocument(@PathVariable Long id) { docRepo.deleteById(id); }

    // ----- Chatbot: cấu hình -----
    @GetMapping("/chatbot/settings")
    public List<AiSetting> settings() { return settingRepo.findAll(); }

    @PutMapping("/chatbot/settings")
    public AiSetting saveSetting(@RequestBody AiSetting s) { return settingRepo.save(s); }

    // ----- Ảnh món ăn -----
    /**
     * Ảnh nằm trong volume `uploads` chứ không đưa vào thư mục public của client, nên URL trả về
     * phải là URL tuyệt đối để hiển thị được ở cả dev (Vite) lẫn bản build qua nginx.
     *
     * <p>Định dạng được xác định bằng chữ ký đầu file chứ không tin Content-Type do client khai,
     * vì client tự do đặt header này cho bất kỳ nội dung nào.
     */
    @PostMapping("/uploads/image")
    public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh phải có dung lượng từ 1 byte đến 2 MB");
        }
        try {
            byte[] head = new byte[12];
            try (InputStream in = file.getInputStream()) {
                if (in.readNBytes(head, 0, head.length) < 12) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp ảnh không hợp lệ");
                }
            }
            String ext = imageExtension(head);
            if (ext == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
            }
            Files.createDirectories(uploadDir);
            String name = UUID.randomUUID() + ext;
            file.transferTo(uploadDir.resolve(name).toAbsolutePath());
            String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/api/uploads/").path(name).toUriString();
            return Map.of("url", url);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không lưu được ảnh lên máy chủ");
        }
    }

    /** Trả về phần mở rộng nếu 12 byte đầu khớp chữ ký JPEG, PNG hoặc WEBP. */
    private String imageExtension(byte[] h) {
        if ((h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8) return ".jpg";
        if ((h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return ".png";
        if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return ".webp";
        return null;
    }
}