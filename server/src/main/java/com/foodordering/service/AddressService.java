package com.foodordering.service;

import com.foodordering.dto.AddressDtos.AddressRequest;
import com.foodordering.dto.AddressDtos.AddressResponse;
import com.foodordering.entity.User;
import com.foodordering.entity.UserAddress;
import com.foodordering.repository.UserAddressRepository;
import com.foodordering.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AddressService {
    private final UserAddressRepository addressRepo;
    private final UserRepository userRepo;

    public AddressService(UserAddressRepository addressRepo, UserRepository userRepo) {
        this.addressRepo = addressRepo;
        this.userRepo = userRepo;
    }

    public List<AddressResponse> list(String email) {
        return addressRepo.findByUserIdOrderByIsDefaultDescCreatedAtAsc(currentUser(email).getId()).stream()
                .map(AddressService::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse create(String email, AddressRequest req) {
        User user = currentUser(email);
        UserAddress address = new UserAddress();
        address.setUser(user);
        apply(address, req);
        // Địa chỉ đầu tiên hoặc địa chỉ được đánh dấu luôn trở thành mặc định, các địa chỉ cũ bỏ mặc định.
        boolean first = addressRepo.findByUserId(user.getId()).isEmpty();
        if (req.isDefault() || first) {
            clearDefaults(user.getId());
            address.setDefault(true);
        }
        return toResponse(addressRepo.save(address));
    }

    @Transactional
    public AddressResponse update(String email, Long id, AddressRequest req) {
        UserAddress address = owned(email, id);
        apply(address, req);
        if (req.isDefault()) {
            clearDefaults(address.getUser().getId());
            address.setDefault(true);
        }
        return toResponse(addressRepo.save(address));
    }

    @Transactional
    public AddressResponse setDefault(String email, Long id) {
        UserAddress address = owned(email, id);
        clearDefaults(address.getUser().getId());
        address.setDefault(true);
        return toResponse(addressRepo.save(address));
    }

    @Transactional
    public void delete(String email, Long id) {
        UserAddress address = owned(email, id);
        addressRepo.delete(address);
        // Nếu xóa địa chỉ mặc định, nâng địa chỉ đầu tiên còn lại lên làm mặc định.
        if (address.isDefault()) {
            addressRepo.findByUserId(address.getUser().getId()).stream()
                    .findFirst()
                    .ifPresent(next -> {
                        clearDefaults(address.getUser().getId());
                        next.setDefault(true);
                        addressRepo.save(next);
                    });
        }
    }

    private void apply(UserAddress address, AddressRequest req) {
        address.setLabel(req.label() == null ? "" : req.label().trim());
        address.setReceiverName(req.receiverName().trim());
        address.setPhone(req.phone());
        address.setAddress(req.address().trim());
    }

    private UserAddress owned(String email, Long id) {
        UserAddress address = addressRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Địa chỉ không tồn tại"));
        if (!address.getUser().getEmail().equals(email)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Địa chỉ không tồn tại");
        }
        return address;
    }

    private void clearDefaults(Long userId) {
        addressRepo.findByUserId(userId).stream()
                .filter(UserAddress::isDefault)
                .forEach(a -> a.setDefault(false));
    }

    private User currentUser(String email) {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
    }

    private static AddressResponse toResponse(UserAddress address) {
        return new AddressResponse(address.getId(), address.getLabel(), address.getReceiverName(),
                address.getPhone(), address.getAddress(), address.isDefault());
    }
}
