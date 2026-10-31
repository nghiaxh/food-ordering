package com.foodordering.controller;

import com.foodordering.dto.PromotionDtos.PromotionRequest;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.PromotionRepository;
import com.foodordering.service.PromotionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admin/promotions")
public class PromotionController {
    private final PromotionRepository repo;
    private final PromotionService service;

    public PromotionController(PromotionRepository repo, PromotionService service) {
        this.repo = repo;
        this.service = service;
    }

    @GetMapping
    public List<Promotion> list() { return repo.findAll(); }

    @PostMapping
    public Promotion create(@Valid @RequestBody PromotionRequest req) {
        if (req.endsAt().isBefore(req.startsAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        Promotion p = new Promotion();
        apply(p, req);
        return repo.save(p);
    }

    @PutMapping("/{id}")
    public Promotion update(@PathVariable Long id, @Valid @RequestBody PromotionRequest req) {
        Promotion p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khuyến mãi"));
        if (req.endsAt().isBefore(req.startsAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        apply(p, req);
        return repo.save(p);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khuyến mãi");
        }
        repo.deleteById(id);
    }

    private void apply(Promotion p, PromotionRequest r) {
        p.setName(r.name());
        p.setDescription(r.description());
        p.setDiscountType(r.discountType());
        p.setDiscountValue(r.discountValue());
        p.setMaxDiscount(r.maxDiscount());
        p.setScope(r.scope());
        p.setTargetIds(r.targetIds() == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(r.targetIds()));
        p.setStartsAt(r.startsAt());
        p.setEndsAt(r.endsAt());
        p.setDaysOfWeek((r.daysOfWeek() == null || r.daysOfWeek().isBlank()) ? null : r.daysOfWeek().trim());
        p.setStartTime(r.startTime());
        p.setEndTime(r.endTime());
        p.setActive(r.active());
        p.setPriority(r.priority());
        p.setUsageLimit(r.usageLimit());
        p.setRandomCount(r.randomCount());
    }
}
