package com.foodordering.service;

import com.foodordering.dto.OrderDtos.*;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrderService {
    private final OrdersRepository orderRepo;
    private final FoodRepository foodRepo;
    private final UserRepository userRepo;
    private final PaymentTransactionRepository paymentTxRepo;
    private final NotificationRepository notificationRepo;

    public OrderService(OrdersRepository orderRepo, FoodRepository foodRepo, UserRepository userRepo,
                        PaymentTransactionRepository paymentTxRepo, NotificationRepository notificationRepo) {
        this.orderRepo = orderRepo;
        this.foodRepo = foodRepo;
        this.userRepo = userRepo;
        this.paymentTxRepo = paymentTxRepo;
        this.notificationRepo = notificationRepo;
    }

    @Transactional
    public Orders create(String email, CreateOrderRequest req) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders order = new Orders();
        order.setUser(user);
        order.setReceiverName(req.receiverName());
        order.setPhone(req.phone());
        order.setAddress(req.address());
        order.setPaymentMethod(req.paymentMethod());
        // Khách có thể để trống ghi chú; trim để lưu gọn và so khớp với giá trị đã validate ở DTO.
        order.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());

        Orders saved = orderRepo.save(order);
        savePaymentTx(saved);
        notify(saved, "Đơn hàng #" + saved.getId() + " đã được tạo. Chúng tôi sẽ sớm xác nhận đơn của bạn.");
        return saved;
    }

    // ----- Quản trị: tạo, sửa, xóa đơn thay khách (UC12) -----

    @Transactional
    public Orders adminCreate(AdminOrderRequest req) {
        User user = userRepo.findByEmail(req.customerEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khách hàng không tồn tại"));
        Orders order = new Orders();
        order.setUser(user);
        applyDelivery(order, req.receiverName(), req.phone(), req.address(), req.paymentMethod(), req.note());
        fillItems(order, req.items());
        if (req.status() != null && !req.status().isBlank()) {
            order.setStatus(parseStatus(req.status()));
        }

        Orders saved = orderRepo.save(order);
        savePaymentTx(saved);
        if (Boolean.TRUE.equals(req.paid())) applyPayment(saved, true);
        return saved;
    }

    @Transactional
    public Orders adminUpdate(Long id, AdminOrderRequest req) {
        Orders order = findOrder(id);
        if (req.receiverName() != null) applyDelivery(order, req.receiverName(), req.phone(), req.address(),
                req.paymentMethod() == null ? order.getPaymentMethod() : req.paymentMethod(), req.note());
        // orphanRemoval giải phóng các dòng cũ khi thay cả danh sách món của đơn.
        if (req.items() != null && !req.items().isEmpty()) {
            order.getItems().clear();
            fillItems(order, req.items());
            paymentTxRepo.findByOrderId(id).ifPresent(tx -> tx.setAmount(order.getTotal()));
        }
        if (req.status() != null && !req.status().isBlank()) {
            Orders.Status next = parseStatus(req.status());
            if (next != order.getStatus()) {
                if (!isValidTransition(order.getStatus(), next)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Không thể chuyển đơn từ \"" + label(order.getStatus()) + "\" sang \"" + label(next) + "\"");
                }
                order.setStatus(next);
            }
        }
        Orders saved = orderRepo.save(order);
        if (req.paid() != null) applyPayment(saved, req.paid());
        return saved;
    }

    @Transactional
    public void adminDelete(Long id) {
        Orders order = findOrder(id);
        // Giao dịch thanh toán giữ khoá ngoại tới đơn nên phải xoá trước, nếu không
        // việc xoá đơn luôn dính lỗi ràng buộc và trả 409.
        paymentTxRepo.deleteByOrderId(id);
        orderRepo.delete(order);
    }

    private Orders findOrder(Long id) {
        return orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
    }

    private void applyDelivery(Orders order, String receiverName, String phone, String address,
                              String paymentMethod, String note) {
        order.setReceiverName(receiverName);
        order.setPhone(phone);
        order.setAddress(address);
        order.setPaymentMethod(paymentMethod);
        // Khách có thể để trống ghi chú; trim để lưu gọn và so khớp với giá trị đã validate ở DTO.
        order.setNote(note == null || note.isBlank() ? null : note.trim());
    }

    /** Giá không lấy từ request; mỗi món được đọc lại từ Food trong database rồi chụp lại vào dòng đơn. */
    private void fillItems(Orders order, List<OrderItemRequest> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest it : req.items()) {
            Food food = foodRepo.findById(it.foodId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
            if (!food.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món \"" + food.getName() + "\" đã ngừng phục vụ");
            }
            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setFood(food);
            oi.setQuantity(it.quantity());
            oi.setPrice(food.getPrice());
            order.getItems().add(oi);
            total = total.add(food.getPrice().multiply(BigDecimal.valueOf(it.quantity())));
        }
        order.setTotal(total);
        Orders saved = orderRepo.save(order);

        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(saved);
        tx.setMethod(saved.getPaymentMethod());
        tx.setAmount(saved.getTotal());
        paymentTxRepo.save(tx);

        notify(saved, "Đơn hàng #" + saved.getId() + " đã được tạo. Nhà hàng sẽ sớm xác nhận đơn của bạn.");
        return saved;
    }

    public List<Orders> myOrders(String email) {
        User user = userRepo.findByEmail(email).orElseThrow();
        return orderRepo.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public List<Orders> all() {
        return orderRepo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Orders updateStatus(Long id, String status) {
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
        Orders.Status next = Orders.Status.valueOf(status);
        o.setStatus(next);
        Orders saved = orderRepo.save(o);

        String content = switch (next) {
            case CONFIRMED -> "Đơn hàng #" + id + " đã được nhà hàng xác nhận.";
            case PREPARING -> "Đơn hàng #" + id + " đang được chuẩn bị.";
            case COMPLETED -> "Đơn hàng #" + id + " đã hoàn thành. Cảm ơn bạn đã đặt món!";
            case CANCELLED -> "Đơn hàng #" + id + " đã bị hủy. Liên hệ nhà hàng nếu bạn cần hỗ trợ.";
            default -> null;
        };
        if (content != null) notify(saved, content);
        return saved;
    }

    @Transactional
    public Orders updatePayment(Long id, boolean paid) {
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
        Orders.PaymentStatus next = paid ? Orders.PaymentStatus.PAID : Orders.PaymentStatus.UNPAID;
        if (o.getPaymentStatus() == next) return o;
        o.setPaymentStatus(next);
        Orders saved = orderRepo.save(o);

        paymentTxRepo.findByOrderId(id).ifPresent(tx -> {
            if (paid) {
                tx.setStatus(PaymentTransaction.Status.PAID);
                tx.setPaidAt(LocalDateTime.now());
            } else {
                tx.setStatus(PaymentTransaction.Status.PENDING);
                tx.setPaidAt(null);
            }
            paymentTxRepo.save(tx);
        });

        String content = paid
                ? "Đơn hàng #" + id + " đã được ghi nhận thanh toán."
                : "Đơn hàng #" + id + " chuyển về trạng thái chưa thanh toán.";
        notify(saved, content);
        return saved;
    }

    private void notify(Orders order, String content) {
        Notification n = new Notification();
        n.setUser(order.getUser());
        n.setContent(content);
        notificationRepo.save(n);
    }
}
