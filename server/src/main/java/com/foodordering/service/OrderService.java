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

    // Đơn, giao dịch thanh toán và thông báo được ghi trong cùng một transaction.
    @Transactional
    public Orders create(String email, CreateOrderRequest req) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders order = new Orders();
        order.setUser(user);
        applyDelivery(order, req.receiverName(), req.phone(), req.address(), req.paymentMethod(), req.note());
        fillItems(order, req.items());

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

    /** Thanh toán hiện là bản ghi mô phỏng; trạng thái được cập nhật riêng. */
    private void savePaymentTx(Orders order) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(order);
        tx.setMethod(order.getPaymentMethod());
        tx.setAmount(order.getTotal());
        paymentTxRepo.save(tx);
    }

    private Orders.Status parseStatus(String status) {
        try {
            return Orders.Status.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái đơn không hợp lệ");
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
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
        Orders.Status next = parseStatus(status);
        // Quy trình chỉ đi theo một chiều; đơn đã chốt (Hoàn thành/Hủy) không đổi trạng thái nữa.
        if (!isValidTransition(o.getStatus(), next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chuyển đơn từ \"" + label(o.getStatus()) + "\" sang \"" + label(next) + "\"");
        }
        o.setStatus(next);
        Orders saved = orderRepo.save(o);

        // Mỗi trạng thái nghiệp vụ có nội dung thông báo tương ứng; PENDING không gửi thông báo lặp.
        String content = switch (next) {
            case CONFIRMED -> "Đơn hàng #" + id + " đã được xác nhận.";
            case PREPARING -> "Đơn hàng #" + id + " đang được chuẩn bị.";
            case COMPLETED -> "Đơn hàng #" + id + " đã hoàn thành. Cảm ơn bạn đã đặt món!";
            case CANCELLED -> "Đơn hàng #" + id + " đã bị hủy. Liên hệ hotline nếu bạn cần hỗ trợ.";
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

    private String label(Orders.Status s) {
        return switch (s) {
            case PENDING -> "Chờ xác nhận";
            case CONFIRMED -> "Đã xác nhận";
            case PREPARING -> "Đang chuẩn bị";
            case COMPLETED -> "Hoàn thành";
            case CANCELLED -> "Đã hủy";
        };
    }

    /** Khách chỉ tự hủy được đơn còn chờ xác nhận; quán đã vào chế biến thì phải gọi hotline. */
    @Transactional
    public Orders cancel(String email, Long id) {
        Orders o = ownOrder(email, id);
        if (o.getStatus() != Orders.Status.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ đơn đang chờ xác nhận mới hủy được. Vui lòng liên hệ hotline.");
        }
        o.setStatus(Orders.Status.CANCELLED);
        Orders saved = orderRepo.save(o);
        notify(saved, "Đơn hàng #" + id + " đã được hủy theo yêu cầu của bạn.");
        return saved;
    }

    /** Thanh toán giả lập: khách tự xác nhận đã trả, hệ thống chỉ ghi nhận trạng thái. */
    @Transactional
    public Orders pay(String email, Long id) {
        ownOrder(email, id);
        return updatePayment(id, true);
    }

    /** Chặn việc khách đọc hoặc thao tác lên đơn của người khác. */
    private Orders ownOrder(String email, Long id) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
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

    /** Đồng bộ trạng thái thanh toán của đơn với giao dịch tương ứng; trả về đơn đã lưu. */
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
