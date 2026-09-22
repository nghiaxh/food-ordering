# Kiến trúc FoodOrdering

Tài liệu mô tả cách FoodOrdering vận hành: các thành phần, luồng dữ liệu, xác thực, chatbot và những quy ước quan trọng khi làm việc.

> Dự án đang ở giai đoạn **scaffolding** — code hiện chỉ có khung lớp (package + stub). Tài liệu này mô tả kiến trúc thiết kế sẽ được triển khai chi tiết.

## Tổng quan

FoodOrdering là ứng dụng **đặt món trực tuyến** theo mô hình monorepo gồm client và server. Điểm khác biệt là **trợ lý AI** tư vấn món ăn theo ngôn ngữ tự nhiên, gợi ý luôn nằm trong thực đơn thật và đặt được ngay.

```
┌──────────────────┐  same-origin /api (Vite dev proxy / nginx)  ┌──────────────────────┐
│  Vite SPA client │  ─────────────────────────────────────────▶ │  Spring Boot server  │
│(React + antd 6)  │ ◀─────────────────────────────────────────  │  Java 25 + JPA       │
└──────────────────┘    Authorization: Bearer (JWT)              └──────────┬───────────┘
                                                                             │
                                                       PostgreSQL 18 (ddl-auto: update)
```

- **client/**: React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + Zustand 5 + Axios + React Router 7. SPA thuần, không SSR. UI tiếng Việt. Ở dev, Vite proxy `/api` tới `VITE_API_URL` (default http://localhost:8080/api); ở prod, container nginx (nginx.conf) proxy `/api` tới service server.
- **server/**: Spring Boot 3.5 (Java 25) + Spring Security (JWT access token đơn giản) + Spring Data JPA. Package gốc `com.foodordering`, layered `controller` → `service` → `repository`.
- **PostgreSQL**: `ddl-auto: update` đồng bộ schema khi khởi động (không dùng Flyway).

## Luồng dữ liệu chính

### 1. Xác thực (JWT access token)

1. Client gọi `POST /api/auth/login` hoặc `POST /api/auth/register` với email và mật khẩu.
2. Server trả về access token JWT kèm thông tin user và role (ADMIN / CUSTOMER).
3. Client lưu token, gắn `Authorization: Bearer <token>` cho mọi request qua lớp `api/http`.
4. `JwtFilter` trên server đọc và verify token, dựng `SecurityContext`. Token không hợp lệ bị nuốt, request được coi là chưa đăng nhập.
5. `SecurityConfig` stateless: cho phép công khai `POST /api/auth/**`, `GET /api/foods/**` `/api/categories/**` `/api/reviews/**`, `/api/chatbot/**` (khách vãng lai vẫn chat được); yêu cầu `ROLE_ADMIN` cho `/api/admin/**`; phần còn lại `authenticated()`.

Endpoint công khai duy nhất (phần còn lại yêu cầu xác thực):

- `POST /api/auth/**`: login, register
- `GET /api/foods/**`, `/api/categories/**`, `/api/reviews/**`
- `POST /api/chatbot/**`: tư vấn món (không cần đăng nhập)

Bảo vệ route trên client chỉ là UX — **quyền ADMIN được kiểm soát ở server**.

### 2. Duyệt và tìm món

- Trang danh mục gọi `GET /api/foods` và `GET /api/categories`.
- Lọc theo tên, loại, khoảng giá và trạng thái available qua query params.
- Chi tiết món gồm thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá.

### 3. Giỏ hàng (state phía client)

Giỏ hàng **không lưu trên server**; nó là state React với Zustand (`store/cartStore`):

- Thêm/sửa/xóa/clear món, tính tổng tiền phía client.
- Giá món hiển thị từ dữ liệu trả về khi duyệt món.

### 4. Đặt món (giá lấy từ DB)

1. Client gửi `POST /api/orders` với danh sách món + số lượng.
2. `OrderService.create` set `price` = giá trong DB, **không tin giá từ client**; từ chối món ngừng phục vụ.
3. Thanh toán giả lập (COD / chuyển khoản / ví điện tử) — không tích hợp cổng thanh toán thật.
4. Khách hàng theo dõi trạng thái đơn; admin xác nhận/cập nhật trạng thái.

### 5. Trợ lý AI tư vấn món (chống bịa món/giá)

Trợ lý AI được thiết kế thành **2 bước** để AI không bao giờ tự nghĩ ra món hoặc giá:

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [service/AiClient, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

- Prompt truy vấn món chỉ nhận danh sách có sẵn từ `FoodRepository`.
- Lỗi AI/JSON sai thì xử lý bằng `try/catch` → tiêu chí rỗng, hệ thống vẫn chạy bình thường.
- RAG cơ bản (`KnowledgeService`) tách tài liệu thành đoạn và chấm điểm theo từ khóa, không cần vector DB. Admin upload tài liệu tham khảo qua endpoint upload (chỉ cho file, không có upload ảnh món).

## Cấu trúc mã nguồn

### Server (server/src/main/java/com/foodordering/)

```
FoodOrderingApplication.java   entry point
config/        cấu hình (AppProperties, DataSeeder, SecurityConfig liên quan)
security/      JwtUtil, JwtFilter
entity/        JPA entities
repository/    Spring Data JPA repositories
dto/           request/response payloads (đồng bộ thủ công với types client)
service/       nghiệp vụ chính (FoodService, OrderService, AuthService, ChatbotService,
               AiClient, KnowledgeService)
controller/    controller mỏng, mapping dưới /api/...
```

### Client (client/)

```
src/
  main.tsx         bootstrap SPA, render root
  App.tsx          layout gốc và router
  api/             lớp HTTP (http.ts), hàm gọi từng endpoint
  store/           Zustand stores (authStore, cartStore)
  types/           TS interfaces phản ánh DTO backend (giữ đồng bộ thủ công)
  components/      component dùng chung (ChatbotWidget...)
  pages/           trang theo route (auth, foods, cart, orders, admin...)
index.html         entry HTML
vite.config.ts     React plugin, dev server (usePolling cho Docker)
nginx.conf         prod: serve dist/ và proxy /api tới server
```

## Điểm quan trọng khi làm việc

- **Không dùng Flyway**: `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`), idempotent theo `count()` — tự bỏ qua nếu DB đã có dữ liệu.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Đồng bộ types**: `client/src/types/index.ts` phải song song với DTO server. Sửa DTO nhớ cập nhật cả hai phía.
- **AI gọi một nơi duy nhất**: `service/AiClient` là lớp DUY NHẤT gọi Gemini API (REST bằng `RestClient`, `jsonMode` ép JSON, config qua `app.ai.api-key` / `app.ai.model`). Muốn đổi nhà cung cấp AI chỉ sửa file này.
- **Ảnh món** dùng URL ngoài (mặc định placehold.co trong seed). Admin nhập link ảnh trong form, không có endpoint upload ảnh.
- **`JwtFilter` nuốt exception** token không hợp lệ (coi như chưa đăng nhập) — đừng log token.

## Phát triển local (profile dev)

```bash
docker compose --profile dev up --build
```

Stack gồm postgres, server-dev và client-dev. Client truy cập tại http://localhost:5173; đường `/api` được Vite proxy tới http://localhost:8080/api.

- **server-dev**: mount `./server:/app`, hot reload qua `spring-boot-devtools` (restart khi file `.class` đổi). Trong container chỉ mount mã nguồn nên cần tự biên dịch: chạy `docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"` ở terminal riêng (hoặc để IDE biên dịch vào `server/target/classes`).
- **client-dev**: mount `./client:/app` (volume ngăn chặn `node_modules`), Vite HMR với `usePolling` — cập nhật ngay khi lưu file. Chỉ cần build lại image khi đổi `package.json` hoặc `Dockerfile`.
- Cache Maven dùng volume `maven_cache` chung.

## Môi trường và cấu hình

Mọi bí mật nằm trong một file `.env` duy nhất ở root (được docker-compose.yml và server đọc). Server đọc env với fallback mặc định dev (`${VAR:default}` trong application.yml). Lưu ý `mvn spring-boot:run` **không tự nạp `.env`** — phải export vars hoặc chạy qua compose.

| Var                 | Ý nghĩa                                      |
| ------------------- | -------------------------------------------- |
| DB_NAME             | tên database Postgres                        |
| DB_USER             | user Postgres                                |
| DB_PASSWORD         | mật khẩu Postgres                            |
| DB_URL              | JDBC URL kết nối (fallback `jdbc:postgresql://localhost:5432/food_ordering`) |
| JWT_SECRET          | chuỗi bí mật ký token (≥32 ký tự)            |
| JWT_EXPIRATION_MS   | thời gian sống token (mặc định 86400000)     |
| AI_API_KEY          | Gemini API key (Google AI Studio)            |
| AI_MODEL            | model Gemini (mặc định gemini-2.0-flash)     |

Biến chỉ dùng trong docker-compose.yml:

| Var              | Ý nghĩa                                                            |
| ---------------- | ------------------------------------------------------------------ |
| VITE_API_URL     | base URL API cho client build (mặc định http://localhost:8080/api) |

Chạy toàn bộ stack: `docker compose --profile prod up --build` (production, client ở cổng 80) hoặc `docker compose --profile dev up --build` (hot reload, client ở cổng 5173). `docker compose up` (không kèm profile) chỉ khởi động Postgres.