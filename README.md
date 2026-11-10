# FoodOrdering

[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Vue](https://img.shields.io/badge/Vue%203-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Naive UI](https://img.shields.io/badge/Naive%20UI-2.45-18a058?logo=vuedotjs&logoColor=white)](https://www.naiveui.com)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Node](https://img.shields.io/badge/Node.js-26-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169e1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker%20Compose-2496ed?logo=docker&logoColor=white)](https://www.docker.com)

Nền tảng đặt món trực tuyến tích hợp trợ lý AI tư vấn món ăn theo nhu cầu, gợi ý được chọn trực tiếp từ thực đơn.

## Tính năng

**Khách hàng**

- Đăng ký, đăng nhập bằng JWT, xem thực đơn theo danh mục, tìm kiếm và lọc theo tên, loại, giá, ăn kiêng, độ cay.
- Xem chi tiết món, thêm vào giỏ theo tài khoản, đặt món COD hoặc QR, theo dõi đơn và thanh toán.
- Đánh giá sao cho món trong đơn hoàn thành, nhận thông báo, đặt lại đơn cũ, hủy đơn chờ xác nhận.
- Chatbot tư vấn theo khẩu vị, dị ứng, số người và ngân sách, gợi ý món kèm thẻ đặt món.

**Quản trị viên**

- Tổng quan doanh thu, đơn chờ, món bán chạy, duyệt đơn, quản lý món, danh mục, đơn hàng, người dùng.
- Quản lý khuyến mãi tự động theo toàn thực đơn, danh mục hoặc món, theo ngày và khung giờ.
- Cấu hình chatbot, xem hội thoại, báo cáo doanh thu và xuất Excel, tải ảnh món lên server.

## Bắt đầu nhanh

Yêu cầu: Docker + Docker Compose, hoặc Node.js 26 để chạy từng phần lẻ.

Tạo file `.env` từ mẫu rồi điền `AI_API_KEY` và `JWT_SECRET`.

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Chạy bằng Docker Compose:

```bash
# Phát triển
docker compose --profile dev up --build

# Demo hoặc production
docker compose --profile prod up --build -d
```

| Thành phần | Profile dev | Profile prod |
|---|---|---|
| Client | http://localhost:5173 | http://localhost |
| Server API | http://localhost:8080/api | http://localhost:8080/api |
| Database | localhost:5432 | localhost:5432 |

Profile dev không cần thêm watcher biên dịch: server chạy `tsx watch` và tự reload khi file đổi.

## Tài khoản demo

Server tự tạo dữ liệu mẫu khi bảng người dùng còn trống: 5 danh mục, 32 món, 4 khuyến mãi, 15 đơn, 12 đánh giá. Đã có người dùng thì toàn bộ seed bị bỏ qua nên không nhân đôi dữ liệu.

Mật khẩu của mỗi tài khoản bằng phần trước dấu `@` trong email.

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

Reset dữ liệu demo: xoá volume `db_data` rồi chạy lại (`docker compose --profile prod down -v`).

## Công nghệ

| Tầng | Công nghệ |
|---|---|
| Client | Vue 3, TypeScript 7, Vite 8, Naive UI, Tailwind CSS 4, Pinia, Axios, Vue Router |
| Server | Express 5, TypeScript 7, Prisma 7, JWT (jsonwebtoken), bcrypt, zod |
| Database | PostgreSQL 18 (full-text search bằng `tsvector` cho RAG) |
| AI | Gemini hoặc OpenAI qua REST, lớp `AiClient` (`server/src/lib/gemini.ts`) |
| Hạ tầng | Docker Compose, 1 file 2 profile dev và prod |

## Kiểm tra nhanh

```bash
# Client
cd client
npm run typecheck
npm run build

# Server
cd ../server
npx prisma generate
npm test
npm run build
```

## Tài liệu

- [ARCHITECTURE.md](ARCHITECTURE.md) - kiến trúc, luồng dữ liệu và cấu hình
- [TEST.md](TEST.md) - hướng dẫn chạy test
- [BRANCHING.md](BRANCHING.md) - quy ước phân nhánh và commit
- [AGENTS.md](AGENTS.md) - quy ước làm việc cho agent
