# API

Tất cả endpoint gắn dưới `/api` (xem `server/src/app.ts:34-43`). Trả JSON, lỗi trả `{ message }` tiếng Việt. Token Bearer trong header `Authorization`.

Quy ước cột quyền: `Public` không cần token, `Auth` cần đăng nhập, `Customer` cần role `CUSTOMER`, `Admin` cần role `ADMIN`.

## Auth

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Đăng ký; trả token và user |
| POST | `/api/auth/login` | Public | Đăng nhập |
| GET | `/api/auth/me` | Auth | Hồ sơ hiện tại |
| PUT | `/api/auth/me` | Auth | Cập nhật hồ sơ |
| PUT | `/api/auth/password` | Auth | Đổi mật khẩu (cần mật khẩu cũ) |

## Thực đơn

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/categories` | Public | Danh sách danh mục |
| GET | `/api/foods` | Public | Lọc theo `category`, `keyword`, `min`, `max`, `people`, `page` |
| GET | `/api/foods/:id` | Public | Chi tiết món |

## Đánh giá

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/reviews/food/:foodId` | Public | Đánh giá của món |
| POST | `/api/reviews` | Auth | Viết đánh giá (phải đã mua) |
| PUT | `/api/reviews/:id` | Auth | Sửa đánh giá của mình |
| DELETE | `/api/reviews/:id` | Auth | Xoá đánh giá của mình |

## Giỏ hàng

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/cart` | Customer | Danh sách dòng giỏ |
| POST | `/api/cart/items` | Customer | Thêm món, cộng dồn số lượng |
| PATCH | `/api/cart/items/:foodId` | Customer | Đổi số lượng |
| DELETE | `/api/cart/items/:foodId` | Customer | Xoá một dòng |
| DELETE | `/api/cart` | Customer | Xoá toàn bộ giỏ |
| POST | `/api/cart/quote` | Customer | Tính tiền theo danh sách dòng client gửi |

## Đơn hàng khách

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/orders` | Customer | Tạo đơn từ giỏ/đơn hàng |
| GET | `/api/orders/my` | Customer | Danh sách đơn của mình |
| PATCH | `/api/orders/:id/cancel` | Customer | Hủy đơn `PENDING` + `UNPAID` |

## Thanh toán

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| PATCH | `/api/payment/:id/pay` | Customer | Đánh dấu đã trả tiền (QR) |

## Thông báo

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/notifications` | Auth | Danh sách thông báo |
| POST | `/api/notifications/read-all` | Auth | Đánh dấu tất cả đã đọc |
| POST | `/api/notifications/:id/read` | Auth | Đánh dấu một thông báo đã đọc |
| DELETE | `/api/notifications/read` | Auth | Xoá thông báo đã đọc |
| DELETE | `/api/notifications/:id` | Auth | Xoá một thông báo |

## Hồ sơ và địa chỉ

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/profile/addresses` | Auth | Danh sách địa chỉ |
| POST | `/api/profile/addresses` | Auth | Thêm địa chỉ |
| PUT | `/api/profile/addresses/:id` | Auth | Sửa địa chỉ |
| PATCH | `/api/profile/addresses/:id/default` | Auth | Đặt mặc định |
| DELETE | `/api/profile/addresses/:id` | Auth | Xoá địa chỉ |

## Chatbot

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/chatbot/status` | Public | Trạng thái provider AI |
| GET | `/api/chatbot/sessions` | Auth | Danh sách phiên (tối đa 20) |
| GET | `/api/chatbot/sessions/latest` | Auth | Khôi phục phiên mới nhất |
| GET | `/api/chatbot/sessions/:sessionId` | Auth | Chi tiết một phiên |
| DELETE | `/api/chatbot/sessions/:sessionId` | Auth | Xoá phiên |
| POST | `/api/chatbot/chat` | Auth | Gửi một lượt chat (rate limit) |

## Quản trị: món và danh mục

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/admin/foods` | Admin | Thêm món |
| PUT | `/api/admin/foods/:id` | Admin | Sửa món |
| DELETE | `/api/admin/foods/:id` | Admin | Xoá món |
| POST | `/api/admin/categories` | Admin | Thêm danh mục |
| PUT | `/api/admin/categories/:id` | Admin | Sửa danh mục |
| DELETE | `/api/admin/categories/:id` | Admin | Xoá danh mục |

## Quản trị: đơn hàng

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/admin/orders` | Admin | Danh sách đơn |
| POST | `/api/admin/orders` | Admin | Tạo đơn hộ khách |
| PUT | `/api/admin/orders/:id` | Admin | Sửa đơn |
| DELETE | `/api/admin/orders/:id` | Admin | Xoá đơn |
| PATCH | `/api/admin/orders/:id/status` | Admin | Đổi trạng thái |
| PATCH | `/api/admin/orders/:id/payment` | Admin | Đổi trạng thái thanh toán |

## Quản trị: khách hàng

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | Danh sách khách |
| POST | `/api/admin/users` | Admin | Tạo tài khoản |
| PUT | `/api/admin/users/:id` | Admin | Sửa tài khoản |
| DELETE | `/api/admin/users/:id` | Admin | Xoá tài khoản |
| PATCH | `/api/admin/users/:id/active` | Admin | Khoá/mở tài khoản |

## Quản trị: khuyến mãi

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/admin/promotions` | Admin | Danh sách khuyến mãi |
| POST | `/api/admin/promotions` | Admin | Tạo khuyến mãi |
| PUT | `/api/admin/promotions/:id` | Admin | Sửa khuyến mãi |
| DELETE | `/api/admin/promotions/:id` | Admin | Xoá khuyến mãi |

## Quản trị: chatbot và tài liệu

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/admin/chatbot/settings` | Admin | Đọc `max_suggestions`, `extra_rules` |
| PUT | `/api/admin/chatbot/settings` | Admin | Ghi cài đặt |
| GET | `/api/admin/chatbot/documents` | Admin | Danh sách tài liệu |
| GET | `/api/admin/chatbot/documents/stats` | Admin | Thống kê chunk/embed |
| GET | `/api/admin/chatbot/documents/:id/chunks` | Admin | Xem chunk của tài liệu |
| POST | `/api/admin/chatbot/documents` | Admin | Tạo tài liệu thủ công |
| PUT | `/api/admin/chatbot/documents/:id` | Admin | Sửa tài liệu |
| DELETE | `/api/admin/chatbot/documents/:id` | Admin | Xoá tài liệu và chunk |
| POST | `/api/admin/chatbot/documents/upload` | Admin | Tải lên tệp |
| POST | `/api/admin/chatbot/documents/:id/reingest` | Admin | Chia lại chunk và embed |
| POST | `/api/admin/chatbot/documents/:id/embed` | Admin | Embed một tài liệu |
| POST | `/api/admin/chatbot/documents/embed-missing` | Admin | Embed các chunk thiếu vector |
| POST | `/api/admin/chatbot/documents/search-preview` | Admin | Xem trước kết quả retrieval |

## Quản trị: báo cáo và upload

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/admin/reports/summary` | Admin | Tổng quan |
| GET | `/api/admin/reports/revenue` | Admin | Doanh thu theo ngày |
| GET | `/api/admin/reports/top-foods` | Admin | Top món |
| GET | `/api/admin/reports/export` | Admin | Xuất dữ liệu |
| POST | `/api/admin/uploads/image` | Admin | Tải ảnh món |

## Ảnh tĩnh

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/uploads/**` | Public | Phục vụ file đã tải lên |

## Mã lỗi

Xem [Kiến trúc](Kien-truc) phần \"Mã lỗi\". Mọi lỗi đi qua `middleware/error.ts` và trả `{ message }`.

Tiếp theo: [Kiểm thử](Kiem-thu).
