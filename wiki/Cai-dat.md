## Yêu cầu

- Docker và Docker Compose, hoặc
- Node.js 20.19 trở lên (khuyến nghị 26) nếu chạy từng phần.
- Một khoá Gemini trong `AI_API_KEYS` nếu muốn dùng chatbot và embedding.

## Biến môi trường

Tạo file `.env` ở root từ mẫu:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Các biến chính:

| Biến | Ý nghĩa |
|---|---|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Thông tin Postgres; compose tự dựng `DATABASE_URL` |
| `JWT_SECRET` | Bắt buộc, tối thiểu 32 ký tự |
| `JWT_EXPIRATION_MS` | Hạn token, mặc định 86400000 (1 ngày) |
| `AI_API_KEYS` | Một khoá hoặc danh sách Gemini, phân tách dấu phẩy/xuống dòng |
| `AI_MODELS` | Danh sách model chat, xoay khi lỗi 503/404/timeout |
| `EMBEDDING_MODELS` | Model embedding, phải trả về 768 chiều |
| `ORDER_PAYMENT_TIMEOUT_MINUTES` | Số phút trước khi đơn QR chưa thanh toán bị hủy, mặc định 30 |

`.env` không được commit. Cấu hình được đọc và kiểm tra bằng zod ở `server/src/config/env.ts`; thiếu `JWT_SECRET` thì server dừng ngay.

## Chạy bằng Docker Compose

```bash
# Phát triển (hot reload)
docker compose --profile dev up --build

# Demo hoặc production
docker compose --profile prod up --build -d

# Drizzle Studio
docker compose --profile tools up -d drizzle-studio
```

| Thành phần | Dev | Prod |
|---|---|---|
| Client | http://localhost:5173 | http://localhost |
| API | http://localhost:8080/api | http://localhost:8080/api |
| Database | localhost:5432 | localhost:5432 |
| Drizzle Studio | http://localhost:4983 | - |

Service `database` không khai báo `profiles`, nên Postgres luôn chạy kể cả khi gọi `docker compose up` không profile.

Server dev dùng `tsx watch`, tự reload khi file trong `server/src` đổi. Lần chạy đầu chậm khoảng 30 giây vì client chờ server healthy.

## Chạy từng phần

```bash
# Server
cd server
npm ci
npm run dev

# Client (terminal khác)
cd client
npm ci
npm run dev
```

Server đọc `.env` ở root repo trước, sau đó đến `server/.env`. Client dùng `VITE_API_URL` làm `baseURL` của Axios, không có proxy `/api` trong Vite.

## Dữ liệu mẫu

`server/src/db/seed.ts` chỉ chạy khi bảng `users` còn trống. Dữ liệu gồm 5 danh mục, 32 món, 4 khuyến mãi, 15 đơn, 12 đánh giá và vài thông báo.

Mật khẩu demo bằng phần trước dấu `@` trong email:

| Vai trò | Tên | Email | Mật khẩu |
|---|---|---|---|
| ADMIN | Nguyễn Hoàng Nam | namnguyen@demo.com | namnguyen |
| ADMIN | Trần Thu Hương | huongtran@demo.com | huongtran |
| Customer | Phạm Văn Tuấn | tuanpham@demo.com | tuanpham |
| Customer | Nguyễn Minh Khang | khangnguyen@demo.com | khangnguyen |
| Customer | Trần Phương Thảo | thaotran@demo.com | thaotran |
| Customer | Dương Ngọc Linh | linhduong@demo.com | linhduong |
| Customer | Nguyễn Thanh Sơn | sonnguyen@demo.com | sonnguyen |
| Customer | Đặng Quốc Trung | trungdang@demo.com | trungdang |
| Customer | Hoàng Minh Đức | duchoang@demo.com | duchoang |
| Customer | Hoàng Thanh Tùng | tunghoang@demo.com | tunghoang |

Đổi dữ liệu mẫu trên database cũ sẽ không có tác dụng vì seed bị bỏ qua. Reset bằng cách xoá volume:

```bash
docker compose --profile prod down -v
docker compose --profile prod up --build -d
```

## Lệnh CSDL

```bash
cd server
npm run db:generate   # tạo migration từ schema
npm run db:migrate    # áp dụng migration
npm run db:seed       # nạp dữ liệu demo
npm run db:studio     # mở Drizzle Studio
```

Schema khai báo ở `server/src/db/schema.ts`, migration nằm trong `server/drizzle/`, cấu hình ở `server/drizzle.config.ts`.
