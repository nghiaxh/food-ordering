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
        applyDelivery(order, req.receiverName(), req.phone(), req.address(), req.paymentMethod(), req.note());
        fillItems(order, req.items());
        Orders saved = orderRepo.save(order);
        savePaymentTx(saved);
        notify(saved, "Đơn hàng #" + saved.getId() + " đã được tạo. Nhà hàng sẽ sớm xác nhận đơn của bạn.");
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
        if (req.items() != null && !req.items().isEmpty()) {
            if (!canEditItems(order)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Chỉ sửa được món khi đơn đang chờ xác nhận và chưa thanh toán");
            }
            order.getItems().clear();
            fillItems(order, req.items());
            paymentTxRepo.findByOrderId(id).ifPresent(tx -> tx.setAmount(order.getTotal()));
        }
        if (req.status() != null && !req.status().isBlank()) {
            Orders.Status next = parseStatus(req.status());
            if (next != order.getStatus()) {
                transition(order, next);
            }
        }
        Orders saved = orderRepo.save(order);
        if (req.paid() != null) applyPayment(saved, req.paid());
        return saved;
    }

    @Transactional
    public void adminDelete(Long id) {
        Orders order = findOrder(id);
        paymentTxRepo.deleteByOrderId(id);
        orderRepo.delete(order);
    }

    private void savePaymentTx(Orders saved) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(saved);
        tx.setMethod(saved.getPaymentMethod());
        tx.setAmount(saved.getTotal());
        paymentTxRepo.save(tx);
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
        order.setNote(note == null || note.isBlank() ? null : note.trim());
    }

    /** Giá không lấy từ request; mỗi món được đọc lại từ Food trong database rồi chụp lại vào dòng đơn. */
    private void fillItems(Orders order, List<OrderItemRequest> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest it : items) {
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
    }

    private Orders.Status parseStatus(String raw) {
        try {
            return Orders.Status.valueOf(raw.trim().toUpperCase());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ: " + raw);
        }
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
        Orders o = findOrder(id);
        Orders.Status next = parseStatus(status);
        transition(o, next);
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

    private boolean isValidTransition(Orders.Status from, Orders.Status to) {
        if (from == Orders.Status.COMPLETED || from == Orders.Status.CANCELLED) return false;
        if (to == Orders.Status.CANCELLED) return true;
        return switch (from) {
            case PENDING -> to == Orders.Status.CONFIRMED;
            case CONFIRMED -> to == Orders.Status.PREPARING;
            case PREPARING -> to == Orders.Status.COMPLETED;
            default -> false;
        };
    }

    private void transition(Orders order, Orders.Status next) {
        if (!isValidTransition(order.getStatus(), next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chuyển đơn từ \"" + label(order.getStatus()) + "\" sang \"" + label(next) + "\"");
        }
        order.setStatus(next);
    }

    private boolean canEditItems(Orders order) {
        return order.getStatus() == Orders.Status.PENDING
                && order.getPaymentStatus() == Orders.PaymentStatus.UNPAID;
    }

    private String label(Orders.Status s) {
        return switch (s) {
            case PENDING -> "Chờ xác nhận";
            case CONFIRMED -> "Đã xác nhận";
            case PREPARING -> "Đang chuẩn bị";
            case COMPLETED -> "Hoàn thành";
            case CANCELLED -> "Đã hủy";
        };
    }

    @Transactional
    public Orders cancel(String email, Long id) {
        Orders o = ownOrder(email, id);
        if (o.getStatus() != Orders.Status.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ đơn đang chờ xác nhận mới hủy được. Vui lòng liên hệ hotline.");
        }
        if (o.getPaymentStatus() == Orders.PaymentStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Đơn hàng đã thanh toán không thể tự hủy trên hệ thống. Vui lòng liên hệ hotline quán để được hỗ trợ hoàn tiền.");
        }
        o.setStatus(Orders.Status.CANCELLED);
        Orders saved = orderRepo.save(o);
        notify(saved, "Đơn hàng #" + id + " đã được hủy theo yêu cầu của bạn.");
        return saved;
    }

    @Transactional
    public Orders pay(String email, Long id) {
        Orders order = ownOrder(email, id);
        if (order.getStatus() == Orders.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn đã hủy thì không thanh toán được");
        }
        return updatePayment(id, true);
    }

    private Orders ownOrder(String email, Long id) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders o = findOrder(id);
        if (!o.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền với đơn hàng này");
        }
        return o;
    }

    @Transactional
    public Orders updatePayment(Long id, boolean paid) {
        Orders saved = applyPayment(findOrder(id), paid);
        String content = paid
                ? "Đơn hàng #" + id + " đã được ghi nhận thanh toán."
                : "Đơn hàng #" + id + " chuyển về trạng thái chưa thanh toán.";
        notify(saved, content);
        return saved;
    }

    private Orders applyPayment(Orders order, boolean paid) {
        Orders.PaymentStatus next = paid ? Orders.PaymentStatus.PAID : Orders.PaymentStatus.UNPAID;
        if (order.getPaymentStatus() == next) return order;
        order.setPaymentStatus(next);
        Orders saved = orderRepo.save(order);

        paymentTxRepo.findByOrderId(saved.getId()).ifPresent(tx -> {
            if (paid) {
                tx.setStatus(PaymentTransaction.Status.PAID);
                tx.setPaidAt(LocalDateTime.now());
            } else {
                tx.setStatus(PaymentTransaction.Status.PENDING);
                tx.setPaidAt(null);
            }
            paymentTxRepo.save(tx);
        });
        return saved;
    }

    private void notify(Orders order, String content) {
        Notification n = new Notification();
        n.setUser(order.getUser());
        n.setContent(content);
        notificationRepo.save(n);
    }
}
