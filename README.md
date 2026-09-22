# FoodOrdering

Web đặt món tích hợp **Chatbot AI tư vấn món ăn** cho niên luận ngành. Code đơn giản, dễ hiểu, dễ demo.

## Tính năng

### Khách hàng
- Đăng ký / đăng nhập, phiên dùng JWT
- Duyệt danh mục, tìm kiếm và lọc món theo tên, loại, khoảng giá
- Chi tiết món: thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá
- Giỏ hàng và đặt món (thanh toán giả lập: COD / chuyển khoản / ví điện tử)
- Theo dõi trạng thái đơn hàng
- Chatbot tư vấn món ăn (widget góc phải màn hình): hỏi bằng tự nhiên, nhận gợi ý
  kèm thẻ món có link đặt món

### Quản trị
- Quản lý món ăn, danh mục, đơn hàng, người dùng
- Upload tài liệu tham khảo cho chatbot (RAG cơ bản) và chỉnh cấu hình chatbot

## Bắt đầu nhanh

### Yêu cầu
- Docker + Docker Compose (hoặc Node.js 20 + JDK 17 + Maven để chạy riêng lẻ)

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

Chế độ phát triển (hot reload cả client lẫn server):

```bash
docker compose --profile dev up --build
```

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

Server tự tạo dữ liệu mẫu khi khởi động (idempotent, không nhân đôi khi chạy lại).

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| ADMIN   | `admin@demo.com` | `admin123` |
| Customer | `user@demo.com` | `user123` |

Reset dữ liệu demo: xoá volume `db_data` rồi chạy lại.

## Công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Client | React + TypeScript, Vite, Ant Design, Zustand, Axios, React Router |
| Server | Spring Boot 3 (Java 17), Spring Security + JWT, Spring Data JPA |
| Database | PostgreSQL 16 |
| AI | Gemini API (gọi qua REST, class `AiClient`) |
| Hạ tầng | Docker Compose (1 file, 2 profile: `dev` / `prod`) |

## Kiểm thử

Xem [TEST.md](TEST.md) cho kế hoạch kiểm thử từng tầng (Vitest, JUnit, Playwright).
Ở giai đoạn scaffolding chưa có test — sẽ bổ sung khi triển khai code chi tiết.

## Cấu trúc

Xem [AGENTS.md](AGENTS.md) cho kiến trúc và quy ước làm việc,
[BRANCHING.md](BRANCHING.md) cho quy ước phân nhánh và commit.