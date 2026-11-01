package com.foodordering.controller;

import com.foodordering.dto.AddressDtos.AddressRequest;
import com.foodordering.dto.AddressDtos.AddressResponse;
import com.foodordering.service.AddressService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/addresses")
public class AddressController {
    private final AddressService addressService;

    public AddressController(AddressService addressService) {
        this.addressService = addressService;
    }

    @GetMapping
    public List<AddressResponse> mine(Authentication auth) {
        return addressService.list(auth.getName());
    }

    @PostMapping
    public AddressResponse create(Authentication auth, @Valid @RequestBody AddressRequest req) {
        return addressService.create(auth.getName(), req);
    }

    @PutMapping("/{id}")
    public AddressResponse update(Authentication auth, @PathVariable Long id, @Valid @RequestBody AddressRequest req) {
        return addressService.update(auth.getName(), id, req);
    }

    @PatchMapping("/{id}/default")
    public AddressResponse setDefault(Authentication auth, @PathVariable Long id) {
        return addressService.setDefault(auth.getName(), id);
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        addressService.delete(auth.getName(), id);
    }
}
