Base URL khi chạy dev: `http://localhost:8080/api`.

- Client gửi token qua header `Authorization: Bearer <token>`.
- Lỗi trả `{ "message": "..." }` bằng tiếng Việt với mã 4xx/5xx phù hợp (`server/src/middleware/error.ts`).
- Route được gắn trong `server/src/app.ts`.

## Công khai

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| POST | `/auth/register` | Đăng ký |
| POST | `/auth/login` | Trả token |
| GET | `/categories` | Danh sách danh mục |
| GET | `/foods` | Query: `keyword`, `categoryId`, `minPrice`, `maxPrice`, `people` |
| GET | `/foods/:id` | Chi tiết món |
| GET | `/reviews/food/:foodId` | Đánh giá của món; `optionalAuth` để đánh dấu `mine` |
| GET | `/uploads/**` | File ảnh đã tải lên |
| GET | `/chatbot/status` | Trạng thái trợ lý AI |

## Cần đăng nhập

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/auth/me` | Người dùng hiện tại |
| PUT | `/auth/me` | Sửa hồ sơ |
| PUT | `/auth/password` | Đổi mật khẩu |
| GET | `/addresses` | Địa chỉ đã lưu |
| POST | `/addresses` | Thêm địa chỉ |
| PUT | `/addresses/:id` | Sửa địa chỉ |
| PATCH | `/addresses/:id/default` | Đặt mặc định |
| DELETE | `/addresses/:id` | Xoá địa chỉ |
| GET | `/notifications` | Danh sách thông báo |
| POST | `/notifications/read-all` | Đánh dấu tất cả đã đọc |
| DELETE | `/notifications/read` | Xoá thông báo đã đọc |
| POST | `/notifications/:id/read` | Đánh dấu một thông báo |
| DELETE | `/notifications/:id` | Xoá một thông báo |
| POST | `/reviews` | Tạo đánh giá |
| PUT | `/reviews/:id` | Sửa đánh giá của mình |
| DELETE | `/reviews/:id` | Xoá đánh giá của mình |
| POST | `/chatbot/chat` | Body: `message`, `sessionId?` |
| GET | `/chatbot/sessions` | Tối đa 20 phiên mới nhất |
| GET | `/chatbot/sessions/latest` | Phiên mới nhất |
| GET | `/chatbot/sessions/:sessionId` | Chi tiết phiên |
| DELETE | `/chatbot/sessions/:sessionId` | Xoá phiên |

Chatbot và lịch sử hội thoại yêu cầu đăng nhập; khách vãng lai không chat được.

## Khách hàng (`CUSTOMER`)

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/cart` | Giỏ hiện tại |
| POST | `/cart/items` | Body: `foodId`, `quantity` |
| PATCH | `/cart/items/:foodId` | Đổi số lượng |
| DELETE | `/cart/items/:foodId` | Xoá một món |
| DELETE | `/cart` | Xoá cả giỏ |
| POST | `/cart/quote` | Tính tiền cho danh sách dòng client đang hiển thị |
| POST | `/orders` | Tạo đơn |
| GET | `/orders/my` | Đơn của tôi |
| PATCH | `/orders/:id/cancel` | Hủy đơn `PENDING` chưa thanh toán |
| PATCH | `/orders/:id/pay` | Đánh dấu đã thanh toán (QR) |

## Quản trị (`ADMIN`)

Tất cả nằm dưới `/api/admin`. Middleware `requireRole("ADMIN")` gắn ở `server/src/admin/routes.ts`.

### Thực đơn

| Method | Đường dẫn |
|---|---|
| POST | `/admin/foods` |
| PUT | `/admin/foods/:id` |
| DELETE | `/admin/foods/:id` |
| POST | `/admin/categories` |
| PUT | `/admin/categories/:id` |
| DELETE | `/admin/categories/:id` |

### Đơn hàng và thanh toán

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/admin/orders` | Toàn bộ đơn |
| POST | `/admin/orders` | Tạo đơn hộ khách |
| PUT | `/admin/orders/:id` | Sửa đơn |
| DELETE | `/admin/orders/:id` | Xoá đơn |
| PATCH | `/admin/orders/:id/status` | Body: `status` |
| PATCH | `/admin/orders/:id/payment?paid=true\|false` | Đã/chưa thanh toán |

### Khách hàng

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/admin/users` | Danh sách |
| POST | `/admin/users` | Tạo tài khoản |
| PUT | `/admin/users/:id` | Sửa tài khoản |
| DELETE | `/admin/users/:id` | Xoá tài khoản |
| PATCH | `/admin/users/:id/active?active=true\|false` | Khoá/mở khoá |

Không sửa, khoá hoặc xoá tài khoản quản trị.

### Khuyến mãi

| Method | Đường dẫn |
|---|---|
| GET | `/admin/promotions` |
| POST | `/admin/promotions` |
| PUT | `/admin/promotions/:id` |
| DELETE | `/admin/promotions/:id` |

### Báo cáo

| Method | Đường dẫn | Query |
|---|---|---|
| GET | `/admin/reports/summary` | `from`, `to` |
| GET | `/admin/reports/revenue` | `from`, `to` |
| GET | `/admin/reports/top-foods` | `from`, `to`, `limit` |
| GET | `/admin/reports/export` | `from`, `to`; trả file `.xlsx` |

`from`/`to` dạng `"YYYY-MM-DD"` là ngày lịch Việt Nam.

### Chatbot

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/admin/chatbot/settings` | Cấu hình |
| PUT | `/admin/chatbot/settings` | `settingKey`, `settingValue` |
| GET | `/admin/chatbot/documents` | Danh sách tài liệu |
| GET | `/admin/chatbot/documents/stats` | Thống kê chunk/vector |
| GET | `/admin/chatbot/documents/:id/chunks` | Xem chunk |
| POST | `/admin/chatbot/documents` | Thêm tài liệu bằng text |
| PUT | `/admin/chatbot/documents/:id` | Sửa tài liệu |
| DELETE | `/admin/chatbot/documents/:id` | Xoá tài liệu |
| POST | `/admin/chatbot/documents/upload` | Upload PDF/DOCX/TXT/MD, tối đa 10 MB |
| POST | `/admin/chatbot/documents/:id/reingest` | Chia lại chunk |
| POST | `/admin/chatbot/documents/:id/embed` | Embed một tài liệu |
| POST | `/admin/chatbot/documents/embed-missing` | Embed các chunk còn thiếu |
| POST | `/admin/chatbot/documents/search-preview` | Thử tìm chunk |

### Ảnh

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| POST | `/admin/uploads/image` | JPG/PNG/WEBP, tối đa 2 MB, trả URL tuyệt đối |
