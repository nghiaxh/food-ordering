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

### Khách hàng
- Đăng ký / đăng nhập, phiên dùng JWT
- Duyệt danh mục, tìm kiếm và lọc món theo tên, loại, khoảng giá
- Chi tiết món: thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá
- Giỏ hàng lưu theo tài khoản (đăng nhập mọi nơi vẫn còn giỏ) và đặt món
  (thanh toán giả lập: COD / QR VietQR)
- Mã khuyến mãi ở giỏ hàng, ví voucher, quà bốc ngẫu nhiên hằng ngày
- Theo dõi trạng thái đơn hàng, trạng thái thanh toán và nhận thông báo xác nhận
- Lịch sử đặt món với nút đặt lại chỉ một chạm và tự hủy đơn khi còn chờ xác nhận
- Đánh giá sao + nhận xét cho món đã ăn (chỉ món trong đơn hoàn thành)
- Chatbot tư vấn món ăn (widget góc phải màn hình): hỏi bằng tự nhiên, nhận gợi ý
  kèm thẻ món có link đặt món. Tư vấn được theo nhu cầu, theo khẩu vị, theo số người ăn
  (tính số phần theo khẩu phần món) và theo tổ hợp món trong một ngân sách chung.

### Quản trị
- Tổng quan nhanh (doanh thu, đơn chờ, món bán chạy), duyệt đơn ngay trên dashboard
- Quản lý món ăn, danh mục, combo, đơn hàng (cập nhật tiến độ + ghi nhận thanh toán), người dùng
- Quản lý khuyến mãi / voucher (giảm theo toàn thực đơn, danh mục, món hoặc combo)
- Cấu hình chatbot (nhà cung cấp AI, mô hình, số món gợi ý, quy tắc bổ sung) và xem lịch sử hội thoại
- Báo cáo doanh thu có biểu đồ, top món và xuất Excel
- Tải ảnh món / danh mục lên server (JPG/PNG/WEBP ≤ 2 MB)

## Bắt đầu nhanh

### Yêu cầu
- Docker + Docker Compose (hoặc Node.js 20.19+ / 22.12+ + JDK 25 + Maven để chạy riêng lẻ)

### 1. Tạo file `.env` từ mẫu

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Điền giá trị thực cho `AI_API_KEY` (Google AI Studio) và đổi `JWT_SECRET` thành
một chuỗi dài bí mật.

### 2. Chạy bằng Docker Compose (đơn giản nhất)

Chế độ phát triển (client HMR và server dev):

```bash
docker compose --profile dev up --build
```

> Với profile `dev`, client có hot reload. Server container cần chạy thêm compiler watcher ở terminal khác để `spring-boot-devtools` restart khi mã Java được biên dịch:
>
> ```bash
> docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"
> ```

Chế độ demo / production (bản build tối ưu):

```bash
docker compose --profile prod up --build -d
```

| Thành phần | Profile dev | Profile prod |
|------------|-------------|--------------|
| Client     | http://localhost:5173 | http://localhost |
| Server API | http://localhost:8080/api | http://localhost:8080/api |
| Database   | localhost:5432 | localhost:5432 |

> Không chạy dev và prod cùng lúc vì trùng cổng 8080 và 5432.
> `docker compose up` (không kèm profile) chỉ khởi động Postgres.

## Tài khoản demo

Server tự tạo dữ liệu mẫu khi bảng người dùng còn trống. Nếu đã có dữ liệu user, toàn bộ seed được bỏ qua nên không nhân đôi dữ liệu demo khi chạy lại.

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| ADMIN   | `admin@demo.com` | `admin123` |
| Customer | `user@demo.com` | `user1234` |

Reset dữ liệu demo: xoá volume `db_data` rồi chạy lại.

## Công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Client | React 19 + TypeScript 7, Vite 8, Ant Design 6, Zustand 5, Axios, React Router 7 |
| Server | Spring Boot 3.5 (Java 25), Spring Security + JWT, Spring Data JPA |
| Database | PostgreSQL 18 |
| AI | Gemini API (gọi qua REST, class `AiClient`) |
| Hạ tầng | Docker Compose (1 file, 2 profile: `dev` / `prod`) |

## Kiểm tra nhanh

Server có vài test tự động cho logic pricing, chatbot và validation DTO (`server/src/test/java`). Lệnh kiểm tra có sẵn:

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

`npm test`, thư mục `e2e/` và framework Vitest/JUnit nâng cao/Playwright là phạm vi kế hoạch trong [TEST.md](TEST.md).

## Tài liệu

- [ARCHITECTURE.md](ARCHITECTURE.md) - kiến trúc, luồng dữ liệu và cấu hình
- [TEST.md](TEST.md) - hướng dẫn chạy test
- [BRANCHING.md](BRANCHING.md) - quy ước phân nhánh và commit
- [AGENTS.md](AGENTS.md) - quy ước làm việc cho agent