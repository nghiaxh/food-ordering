Trang này mô tả các luồng phía khách hàng. Đặt món và thanh toán được tách riêng ở [Đặt món và thanh toán](Luong-dat-mon).

## 1. Đăng ký và đăng nhập

- Trang: `client/src/user/auth/pages/LoginPage.vue`, `RegisterPage.vue`, khung chung `AuthShell.vue`.
- API: `POST /api/auth/register`, `POST /api/auth/login`; lấy thông tin hiện tại `GET /api/auth/me`.
- Server: `server/src/user/auth/routes.ts`, `service.ts`, `schema.ts`; mật khẩu băm bằng bcrypt, token sinh ở `server/src/lib/jwt.ts`.
- Client gọi API qua `client/src/user/auth/api.ts`, lưu người dùng ở `client/src/user/auth/store.ts`.

Sau khi đăng nhập, `client/src/shared/api/http.ts` tự gắn `Authorization: Bearer <token>` cho mọi request.

Khách chưa đăng nhập vẫn xem thực đơn được. Các thao tác cần tài khoản sẽ đưa sang `/login`:

- Bấm giỏ hàng: mở lại giỏ sau khi đăng nhập nhờ cờ `openCart`.
- Bấm nút thêm món trên thẻ món.
- Mở chatbot: widget hiện nút "Đăng nhập".

## 2. Xem thực đơn

- Trang chủ: `client/src/user/menu/pages/FoodsPage.vue`.
- API: `GET /api/categories`, `GET /api/foods`.
- Server: `server/src/user/menu/routes.ts`, `service.ts`.

Bộ lọc nằm trên URL để chia sẻ và quay lại vẫn giữ nguyên:

```
/?category=1&keyword=pho&min=30000&max=90000&people=2&sort=price-asc&diet=chay&spicy=0&available=1&deal=1&page=1
```

Cách lọc:

| Bộ lọc | Xử lý ở đâu |
|---|---|
| `category`, `min`, `max`, `people`, `keyword` | Server, trong `searchFoods` |
| `diet`, `spicy`, `available`, `deal`, `sort` | Client, sau khi nhận danh sách |
| `page` | Client, 12 món mỗi trang |

`people` lọc món có `servingSize >= people`. Giao diện gửi `people=6` cho lựa chọn "Trên 5 người".

Thẻ món ở `client/src/user/menu/components/FoodCard.vue`. Nút dấu cộng không bị disable với khách vãng lai; bấm vào sẽ được đưa sang `/login`.

## 3. Chi tiết món

- Trang riêng: `client/src/user/menu/pages/FoodDetailPage.vue`, route `/foods/:id`.
- API: `GET /api/foods/:id` trong `server/src/user/menu/routes.ts`.
- Giá và khuyến mãi được trang trí ở server qua `decorateFoods` (`server/src/user/pricing/service.ts`).

Khi quay lại, trang dùng `state.from` để giữ nguyên query của thực đơn.

## 4. Giỏ hàng

- Store: `client/src/user/cart/store.ts`.
- API: `client/src/user/cart/api.ts`; server `server/src/user/cart/routes.ts`, `service.ts`.
- Giao diện: `client/src/user/cart/components/CartDrawer.vue`.

Quy tắc:

- Chỉ tài khoản `CUSTOMER` có giỏ. Router server dùng `requireRole("CUSTOMER")`.
- Giỏ lưu trong DB, không lưu local.
- `cartStore.add` trả `Promise<boolean>` và từ chối khi chưa đăng nhập.
- Store thay dòng tạm bằng `CartItem` server trả, để món thêm từ chatbot có đủ trường và đúng giá.
- Phản hồi chỉ được áp theo đúng thứ tự request của từng món.
- `CartItem.quantity` mặc định là `1`, nên module cart tạo dòng mới với `quantity = 0` trước khi cộng.

Giá hiển thị lấy từ quote:

- `POST /api/cart/quote` nhận đúng danh sách dòng client đang hiển thị.
- Client chỉ dùng `client/src/composables/useCartQuote.ts` để gọi quote.
- Quote không đọc lại giỏ trong DB, tránh phản hồi cũ ghi đè giỏ mới.

## 5. Đánh giá món

- Giao diện: `client/src/user/review/components/ReviewSection.vue`, `RatingStars.vue`.
- API: `GET /api/reviews/food/:foodId` công khai; `POST`, `PUT /:id`, `DELETE /:id` cần đăng nhập.
- Server: `server/src/user/review/routes.ts`, `service.ts`.

Ràng buộc:

- Chỉ được đánh giá món đã có trong đơn `COMPLETED` của chính mình.
- Mỗi người một đánh giá cho mỗi món; muốn đổi thì sửa đánh giá cũ.
- Chỉ sửa/xoá được đánh giá của mình. Cờ `mine` trong response chỉ để hiện nút, quyền thật kiểm tra ở server.

## 6. Thông báo

- Store: `client/src/user/notification/store.ts`; API `notification/api.ts`.
- Giao diện: chuông trên header và `NotificationsDrawer.vue`.
- Server: `server/src/user/notification/routes.ts`, `service.ts`.

Thông báo được tạo trong cùng transaction với thao tác phát sinh: tạo đơn, hủy đơn, thanh toán, đổi trạng thái, đơn QR hết hạn.

Store là nguồn chung cho số chưa đọc trên header và danh sách trong drawer. Khi tải lỗi mạng, store giữ nguyên danh sách cũ thay vì xoá sạch.

## 7. Hồ sơ và địa chỉ

- Trang: `client/src/user/profile/pages/ProfilePage.vue`.
- API: `server/src/user/profile/routes.ts`.
- Người dùng sửa họ tên, số điện thoại, đổi mật khẩu.
- Địa chỉ đã lưu: thêm, sửa, xoá, đặt mặc định. Mỗi endpoint đều yêu cầu đăng nhập.

## 8. Chatbot

Chatbot cũng là một luồng của khách hàng nhưng có trang riêng vì logic dài: xem [Chatbot](Luong-chatbot).

Tóm tắt: phải đăng nhập mới dùng được; server đọc tiêu chí, lọc món thật trong SQL rồi mới để AI viết câu trả lời. Thẻ món luôn lấy ID và giá từ CSDL.
