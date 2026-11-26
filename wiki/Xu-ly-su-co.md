# Xử lý sự cố

Trang này liệt kê lỗi thường gặp khi chạy và cách sửa, theo triệu chứng.

## Server không khởi động

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `JWT_SECRET phai co it nhat 32 ky tu` rồi thoát | Thiếu hoặc quá ngắn | Điền chuỗi dài hơn 32 ký tự vào `.env` (`server/src/config/env.ts:26`) |
| `port is already allocated` ở 5432 | Máy đã có Postgres khác | Tắt Postgres local hoặc đổi cổng publish |
| `relation \"vector\" does not exist` | Chưa chạy migration | `cd server && npm run db:migrate` |
| `Da co du lieu, bo qua seed.` | Seed bị bỏ qua vì `users` đã có dòng | `docker compose --profile prod down -v` rồi `up` lại |

## Client không gọi được API

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `Network Error` | Sai `VITE_API_URL` | Khớp cổng server, mặc định 8080 (`client/src/shared/api/http.ts:5-7`) |
| `net::ERR_EMPTY_RESPONSE` | Client chạy trước khi server sẵn sàng | Đợi khoảng 30 giây rồi tải lại |
| 401 liên tục | Token hết hạn hoặc storage hỏng | Đăng nhập lại; interceptor tự xoá storage (`client/src/shared/api/http.ts:26-37`) |

## Chatbot

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `available: false` ở `/api/chatbot/status` | `AI_API_KEYS` rỗng hoặc sai | Điền khoá Gemini thật rồi khởi động lại server |
| Ô nhập bị khoá, banner hiện | Provider không dùng được | Kiểm tra khoá, xem log server |
| Trả lời \"Mình chưa có thông tin xác thực...\" | RAG không tìm được chunk | Upload và embed tài liệu ở `/admin/chatbot` |
| Chunk lưu nhưng thiếu vector | Provider không dùng được khi embed | Sửa khoá rồi bấm \"Cập nhật\" tài liệu |
| Phản hồi chậm | Model timeout, xoay model | Bình thường; kiểm tra `AI_MODELS` |

Kết quả kiểm tra khoá cũ được giữ trong bộ nhớ, nên sau khi đổi khoá phải khởi động lại server.

## Dữ liệu

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Đổi dữ liệu mẫu mà không thấy khác | Seed bị bỏ qua vì `users` đã có dòng | `down -v` rồi `up` lại |
| Món ảnh không hiện | Đường dẫn ảnh trong DB sai | Kiểm tra `food.image_url` và file trong `client/public/images` |

## Docker

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Lần đầu chậm 30 giây | Healthcheck chờ server sẵn sàng | Đợi, đừng bỏ healthcheck |
| `client-dev` không hot reload | Volume mount sai | Kiểm tra `docker-compose.yml` profile dev |
| Drizzle Studio không mở | Chưa chạy profile tools | `docker compose --profile tools up -d` |

## Wiki

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `check-wiki-refs.mjs` báo file không tồn tại | Toạ độ code trỏ sai | Sửa toạ độ trong wiki |
| `check-wiki-refs.mjs` báo vượt số dòng | Code đã đổi sau khi viết wiki | Cập nhật toạ độ |
| Link nội bộ chết | Tên trang sai | Sửa tên trang |

Tiếp theo: [Home](Home).
