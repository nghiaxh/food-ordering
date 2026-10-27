package com.foodordering.service;

import com.foodordering.dto.OrderDtos.*;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrderService {
    private final OrdersRepository orderRepo;
    private final FoodRepository foodRepo;
    private final ComboRepository comboRepo;
    private final UserRepository userRepo;
    private final PaymentTransactionRepository paymentTxRepo;
    private final NotificationRepository notificationRepo;
    private final PricingService pricing;
    private final PromotionService promotionService;

    public OrderService(OrdersRepository orderRepo, FoodRepository foodRepo, ComboRepository comboRepo,
                        UserRepository userRepo, PaymentTransactionRepository paymentTxRepo,
                        NotificationRepository notificationRepo, PricingService pricing,
                        PromotionService promotionService) {
        this.orderRepo = orderRepo;
        this.foodRepo = foodRepo;
        this.comboRepo = comboRepo;
        this.userRepo = userRepo;
        this.paymentTxRepo = paymentTxRepo;
        this.notificationRepo = notificationRepo;
        this.pricing = pricing;
        this.promotionService = promotionService;
    }

    @Transactional
    public Orders create(String email, CreateOrderRequest req) {
        User user = userRepo.findByEmail(email).orElseThrow();
        Orders order = new Orders();
        order.setUser(user);
        applyDelivery(order, req.receiverName(), req.phone(), req.address(), req.paymentMethod(), req.note());
        PricingService.PricedCart priced = fillItems(order, req.items(), req.voucherCode(), user);

        Orders saved = orderRepo.save(order);
        // Voucher chỉ bị trừ lượt sau khi đơn đã ghi thành công, trong cùng transaction.
        promotionService.markUsed(user, priced.voucher());
        savePaymentTx(saved);
        notify(saved, "Đơn hàng #" + saved.getId() + " đã được tạo. Chúng tôi sẽ sớm xác nhận đơn của bạn.");
        return saved;
    }

    // ----- Quản trị: tạo, sửa, xóa đơn thay khách (UC12) -----

    @Transactional
    public Orders adminCreate(AdminOrderRequest req) {
        if (req.items() == null || req.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn phải có ít nhất một món");
        }
        User user = userRepo.findByEmail(req.customerEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khách hàng không tồn tại"));
        Orders order = new Orders();
        order.setUser(user);
        applyDelivery(order, req.receiverName(), req.phone(), req.address(), req.paymentMethod(), req.note());
        PricingService.PricedCart priced = fillItems(order, req.items(), req.voucherCode(), user);
        if (req.status() != null && !req.status().isBlank()) {
            order.setStatus(parseStatus(req.status()));
        }

        Orders saved = orderRepo.save(order);
        promotionService.markUsed(user, priced.voucher());
        savePaymentTx(saved);
        if (Boolean.TRUE.equals(req.paid())) applyPayment(saved, true);
        return saved;
    }

    /**
     * Quán chỉ sửa được món khi đơn còn chờ xác nhận và chưa thu tiền; sau đó chỉ còn
     * địa chỉ, số điện thoại và ghi chú. Đơn đã hoàn thành hoặc đã hủy thì khoá hoàn toàn
     * để số liệu báo cáo và lịch sử của khách không bị sửa ngược.
     */
    @Transactional
    public Orders adminUpdate(Long id, AdminOrderRequest req) {
        Orders order = findOrder(id);
        requireEditable(order);
        applyDelivery(order, req.receiverName(), req.phone(), req.address(),
                req.paymentMethod() == null ? order.getPaymentMethod() : req.paymentMethod(), req.note());

        Promotion usedVoucher = null;
        if (req.items() != null && !req.items().isEmpty()) {
            if (order.getStatus() != Orders.Status.PENDING
                    || order.getPaymentStatus() != Orders.PaymentStatus.UNPAID) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Chỉ sửa được món khi đơn đang chờ xác nhận và chưa thanh toán");
            }
            // orphanRemoval giải phóng các dòng cũ khi thay cả danh sách món của đơn.
            PricingService.PricedCart priced = fillItems(order, req.items(), req.voucherCode(), order.getUser());
            usedVoucher = priced.voucher();
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
        promotionService.markUsed(order.getUser(), usedVoucher);
        if (req.paid() != null) applyPayment(saved, req.paid());
        return saved;
    }

    private void requireEditable(Orders order) {
        if (order.getStatus() == Orders.Status.COMPLETED || order.getStatus() == Orders.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Đơn đã " + (order.getStatus() == Orders.Status.COMPLETED ? "hoàn thành" : "hủy")
                            + " nên không sửa được nữa");
        }
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

    /**
     * Chụp lại đơn từ dữ liệu database. Giá gốc và số tiền giảm của từng dòng do
     * {@link PricingService} tính, nên tổng đơn luôn khớp đúng báo giá khách đã thấy.
     */
    private PricingService.PricedCart fillItems(Orders order, List<OrderItemRequest> items,
                                                String voucherCode, User user) {
        for (OrderItemRequest it : items) {
            requireSellable(it);
        }
        PricingService.PricedCart priced = pricing.priceOrder(items, user, voucherCode);

        order.getItems().clear();
        for (PricingService.Line line : priced.lines()) {
            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setFood(line.food());
            oi.setCombo(line.combo());
            oi.setQuantity(line.quantity());
            oi.setPrice(line.unitPrice());
            oi.setDiscountAmount(line.lineDiscount());
            order.getItems().add(oi);
        }
        order.setTotal(priced.total());
        order.setDiscountTotal(priced.discountTotal());
        order.setPromotionCode(priced.voucher() == null ? null : priced.voucher().getCode());
        return priced;
    }

    /** Món hoặc combo đã ngừng phục vụ không được vào đơn, kể cả khi giỏ đã giữ từ trước. */
    private void requireSellable(OrderItemRequest it) {
        if (it.foodId() != null) {
            Food food = foodRepo.findById(it.foodId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Món không tồn tại"));
            if (!food.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Món \"" + food.getName() + "\" đã ngừng phục vụ");
            }
        } else if (it.comboId() != null) {
            Combo combo = comboRepo.findById(it.comboId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Combo không tồn tại"));
            if (!combo.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Combo \"" + combo.getName() + "\" đã ngừng phục vụ");
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dòng hàng phải có món hoặc combo");
        }
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

    public Orders updateStatus(Long id, String status) {
        Orders o = orderRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn"));
        o.setStatus(Orders.Status.valueOf(status));
        return orderRepo.save(o);
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
        if (o.getPaymentStatus() == Orders.PaymentStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Đơn hàng đã thanh toán không thể tự hủy trên hệ thống. Vui lòng liên hệ hotline quán để được hỗ trợ hoàn tiền.");
        }
        o.setStatus(Orders.Status.CANCELLED);
        Orders saved = orderRepo.save(o);
        notify(saved, "Đơn hàng #" + id + " đã được hủy theo yêu cầu của bạn.");
        return saved;
    }

    /** Thanh toán giả lập: khách tự xác nhận đã trả, hệ thống chỉ ghi nhận trạng thái. */
    @Transactional
    public Orders pay(String email, Long id) {
        Orders order = ownOrder(email, id);
        if (order.getStatus() == Orders.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn đã hủy thì không thanh toán được");
        }
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
