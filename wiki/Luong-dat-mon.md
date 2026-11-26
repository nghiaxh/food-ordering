## 1. Chuẩn bị đơn ở trang thanh toán

Trang: `client/src/user/order/pages/CheckoutPage.vue`, route `/checkout` (yêu cầu đăng nhập).

Các bước trên giao diện:

1. Chọn món trong giỏ. Client lấy báo giá qua `POST /api/cart/quote` bằng `client/src/composables/useCartQuote.ts`.
2. Chọn địa chỉ đã lưu hoặc nhập địa chỉ mới. Địa chỉ CRUD ở `server/src/user/profile/routes.ts`.
3. Chọn thanh toán `COD` hoặc `QR`, thêm ghi chú nếu cần.
4. Bấm đặt món.

Client kiểm tra chữ ký của quote trước khi gửi. Nếu giỏ đã đổi so với lần quote, client yêu cầu quote lại để tránh đặt nhầm giá.

## 2. Tạo đơn ở server

- API: `POST /api/orders`, yêu cầu role `CUSTOMER`.
- Code: `server/src/user/order/routes.ts`, `service.ts` (`createOrder`, `fillItems`).
- Zod schema: `server/src/user/order/schema.ts`.

`createOrder` chạy trong một transaction:

1. Đọc lại giá và khuyến mãi bằng `priceOrder` (`server/src/user/pricing/service.ts`). Giá lấy từ CSDL, không tin client.
2. Tạo dòng trong `orders` với trạng thái mặc định `PENDING`.
3. Tạo các dòng `order_items`, lưu `price` và `discountAmount` tại thời điểm mua.
4. Trừ lượt dùng khuyến mãi bằng `markUsed` trong cùng transaction.
5. Tạo giao dịch thanh toán ban đầu.
6. Tạo thông báo cho khách.

## 3. Thanh toán

### COD

Thanh toán khi nhận hàng. `paymentStatus` bắt đầu là `UNPAID` và không có hạn thanh toán. Quán thu tiền lúc giao.

### QR

Khách quét mã và bấm xác nhận. Gọi:

```
PATCH /api/orders/:id/pay
```

- Route: `server/src/user/payment/routes.ts`.
- Service: `server/src/user/payment/service.ts` gọi `ownOrder` rồi `updatePayment`.
- `updatePayment` ghi `paymentStatus = PAID` và cập nhật giao dịch trong cùng transaction, đồng thời tạo thông báo.

Đơn đã `CANCELLED` không được ghi `PAID`, kể cả khi job hủy vừa chạy.

### Hạn thanh toán QR

- Chỉ đơn `PENDING` + `UNPAID` + `QR` quá `ORDER_PAYMENT_TIMEOUT_MINUTES` (mặc định 30) mới bị hủy.
- Job: `server/src/user/order/expiryJob.ts`, chạy ngay khi server khởi động rồi mỗi 60 giây.
- Job dùng một câu `UPDATE ... WHERE` có điều kiện, nên đơn vừa thanh toán sẽ không khớp.
- Thông báo hủy được tạo trong cùng transaction.
- API trả `paymentDeadlineAt` để client đếm ngược; `null` với COD, đơn đã trả tiền hoặc đơn đã chốt. Logic ở `server/src/user/order/expiry.ts` và `server/src/lib/serializers.ts`.

## 4. Trạng thái đơn

Mã trạng thái và nhãn hiển thị nằm ở `server/src/user/order/transitions.ts`:

| Mã | Nhãn |
|---|---|
| `PENDING` | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận |
| `PREPARING` | Đang vận chuyển |
| `COMPLETED` | Hoàn thành |
| `CANCELLED` | Đã hủy |

Luồng hợp lệ:

```
PENDING -> CONFIRMED -> PREPARING -> COMPLETED
PENDING -> CANCELLED
CONFIRMED -> CANCELLED
```

- `PREPARING` không hủy được.
- `COMPLETED` và `CANCELLED` là trạng thái cuối, không đổi tiếp.
- Đơn `QR` chỉ được chuyển sang `CONFIRMED` khi đã `PAID`.

## 5. Khách hủy đơn

- API: `PATCH /api/orders/:id/cancel`.
- Chỉ hủy được đơn `PENDING` và chưa thanh toán.
- Client ẩn nút bằng `canCancelOrder` trong `client/src/shared/utils/orders.ts`.
- Hủy tự động do hết hạn QR không hoàn `usedCount` của khuyến mãi, giống luồng khách tự hủy.

## 6. Đặt lại đơn cũ

Trang `client/src/user/order/pages/OrdersPage.vue` có nút **Đặt lại** khi đơn `COMPLETED`. Client thêm lại các món của đơn đó vào giỏ, sau đó khách đi qua checkout như bình thường.

## 7. Xem đơn

- API: `GET /api/orders/my`, yêu cầu role `CUSTOMER`.
- Trang: `client/src/user/order/pages/OrdersPage.vue`, hiển thị timeline bằng `OrderTimeline.vue`.
- Mỗi đơn chỉ chủ sở hữu xem được; `ownOrder` trong `server/src/user/order/service.ts` kiểm tra `userId`.

## 8. Quản trị sửa đơn

Quy tắc chi tiết ở [Quản trị](Luong-quan-tri). Tóm tắt:

- Chỉ sửa món khi đơn `PENDING` và `UNPAID`.
- Đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn, kể cả thông tin giao hàng.
- Các trạng thái còn lại chỉ sửa người nhận, số điện thoại, địa chỉ, ghi chú và trạng thái.
