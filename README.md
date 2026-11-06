# FoodOrdering

[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-6.6-1677ff?logo=antdesign&logoColor=white)](https://ant.design)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-443e38?logo=zustand&logoColor=white)](https://zustand-demo.pmnd.rs)
[![React Router](https://img.shields.io/badge/React%20Router-7.18-CA4245?logo=reactrouter&logoColor=white)](https://reactrouter.com)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-6db33f?logo=spring&logoColor=white)](https://spring.io)
[![Java](https://img.shields.io/badge/Java-25-f89820?logo=openjdk&logoColor=white)](https://www.java.com)
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

Yêu cầu: Docker + Docker Compose, hoặc Node.js và JDK cùng Maven để chạy riêng lẻ.

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

Profile dev cần chạy thêm watcher biên dịch để server tự restart, và không chạy dev cùng prod vì trùng cổng.

```bash
docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"
```

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

Reset dữ liệu demo: xoá volume `db_data` rồi chạy lại.

## Công nghệ

| Tầng | Công nghệ |
|---|---|
| Client | React 19, TypeScript 7, Vite 8, Ant Design 6, Zustand 5, Axios, React Router 7 |
| Server | Spring Boot 3.5, Java 25, Spring Security + JWT, Spring Data JPA |
| Database | PostgreSQL 18 |
| AI | Gemini hoặc OpenAI qua REST, class `AiClient` |
| Hạ tầng | Docker Compose, 1 file 2 profile dev và prod |

## Kiểm tra nhanh

```bash
# Client
cd client
npm run typecheck
npm run build

# Server
cd ../server
mvn test
mvn package
```

## Tài liệu

- [ARCHITECTURE.md](ARCHITECTURE.md) - kiến trúc, luồng dữ liệu và cấu hình
- [TEST.md](TEST.md) - hướng dẫn chạy test
- [BRANCHING.md](BRANCHING.md) - quy ước phân nhánh và commit
- [AGENTS.md](AGENTS.md) - quy ước làm việc cho agent
