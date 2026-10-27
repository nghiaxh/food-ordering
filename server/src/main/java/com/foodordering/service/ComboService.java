package com.foodordering.service;

import com.foodordering.dto.ComboDtos;
import com.foodordering.dto.ComboDtos.ComboRequest;
import com.foodordering.entity.Combo;
import com.foodordering.entity.ComboItem;
import com.foodordering.entity.Food;
import com.foodordering.repository.ComboRepository;
import com.foodordering.repository.FoodRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class ComboService {
    private final ComboRepository comboRepo;
    private final FoodRepository foodRepo;
    private final PricingService pricing;

    public ComboService(ComboRepository comboRepo, FoodRepository foodRepo, PricingService pricing) {
        this.comboRepo = comboRepo;
        this.foodRepo = foodRepo;
        this.pricing = pricing;
    }

    public List<Combo> all() {
        List<Combo> combos = comboRepo.findAll();
        pricing.decorateCombos(combos);
        return combos;
    }

    public List<Combo> available() {
        List<Combo> combos = comboRepo.findByAvailableTrue();
        pricing.decorateCombos(combos);
        return combos;
    }

    public Combo getById(Long id) {
        Combo combo = comboRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy combo"));
        pricing.decorateCombos(List.of(combo));
        return combo;
    }

    public Combo create(ComboRequest req) {
        return comboRepo.save(apply(new Combo(), req));
    }

    public Combo update(Long id, ComboRequest req) {
        return comboRepo.save(apply(getById(id), req));
    }

    public void delete(Long id) {
        if (!comboRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy combo");
        }
        comboRepo.deleteById(id);
    }

    private Combo apply(Combo c, ComboRequest r) {
        c.setName(r.name());
        c.setDescription(r.description());
        c.setImageUrl(r.imageUrl());
        c.setPrice(r.price());
        c.setAvailable(r.available());
        c.getItems().clear();
        if (r.items() != null) {
            for (ComboDtos.ComboItemRequest it : r.items()) {
                Food food = foodRepo.findById(it.foodId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
                ComboItem ci = new ComboItem();
                ci.setCombo(c);
                ci.setFood(food);
                ci.setQuantity(it.quantity() <= 0 ? 1 : it.quantity());
                c.getItems().add(ci);
            }
        }
        return c;
    }
}