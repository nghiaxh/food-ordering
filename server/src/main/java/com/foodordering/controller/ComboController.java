package com.foodordering.controller;

import com.foodordering.dto.ComboDtos.ComboRequest;
import com.foodordering.entity.Combo;
import com.foodordering.service.ComboService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/combos")
public class ComboController {
    private final ComboService service;

    public ComboController(ComboService service) { this.service = service; }

    @GetMapping
    public List<Combo> list() { return service.available(); }

    @GetMapping("/{id}")
    public Combo get(@PathVariable Long id) { return service.getById(id); }
}

@RestController
@RequestMapping("/api/admin/combos")
class AdminComboController {
    private final ComboService service;

    AdminComboController(ComboService service) { this.service = service; }

    @GetMapping
    public List<Combo> list() { return service.all(); }

    @PostMapping
    public Combo create(@Valid @RequestBody ComboRequest req) { return service.create(req); }

    @PutMapping("/{id}")
    public Combo update(@PathVariable Long id, @Valid @RequestBody ComboRequest req) { return service.update(id, req); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }
}