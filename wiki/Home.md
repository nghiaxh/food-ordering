Nền tảng đặt món trực tuyến tích hợp trợ lý AI tư vấn món ăn. Khách xem thực đơn, đặt món, thanh toán và trò chuyện với chatbot; quản trị viên duyệt đơn, quản lý thực đơn, khuyến mãi và xem báo cáo.

## Bắt đầu nhanh

```bash
cp .env.example .env
docker compose --profile dev up --build
```

- Client: http://localhost:5173
- API: http://localhost:8080/api
- Database: localhost:5432

Chi tiết cấu hình và tài khoản demo ở [Cài đặt](Cai-dat).

## Điều hướng

| Trang | Nội dung |
|---|---|
| [Tổng quan](Tong-quan) | Mục tiêu, công nghệ, cấu trúc repo |
| [Cài đặt](Cai-dat) | Biến môi trường, Docker Compose, dữ liệu mẫu |
| [Kiến trúc](Kien-truc) | Client, server, xác thực, xử lý lỗi, CSDL |
| [Luồng khách hàng](Luong-khach-hang) | Đăng nhập, thực đơn, giỏ, đánh giá, thông báo |
| [Đặt món và thanh toán](Luong-dat-mon) | Tạo đơn, COD/QR, trạng thái, hủy, hết hạn |
| [Chatbot](Luong-chatbot) | Cách chọn món, gọi AI, RAG tài liệu quán |
| [Quản trị](Luong-quan-tri) | Duyệt đơn, món, khuyến mãi, báo cáo |
| [API](API) | Danh sách endpoint theo module và quyền |
| [Kiểm thử](Kiem-thu) | Typecheck, unit test, build, E2E, CI |
| [Triển khai](Trien-khai) | Chạy production, upload ảnh, pgvector |

## Tài khoản demo

Mật khẩu bằng phần trước dấu `@` của email.

| Vai trò | Email | Mật khẩu |
|---|---|---|
| ADMIN | namnguyen@demo.com | namnguyen |
| ADMIN | huongtran@demo.com | huongtran |
| Customer | tuanpham@demo.com | tuanpham |
| Customer | khangnguyen@demo.com | khangnguyen |

Danh sách đầy đủ nằm trong [Cài đặt](Cai-dat).
