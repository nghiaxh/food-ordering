# Kiến trúc FoodOrdering

Tài liệu mô tả cách FoodOrdering vận hành: các thành phần, luồng dữ liệu, xác thực, chatbot và những quy ước quan trọng khi làm việc.

## Tổng quan

FoodOrdering là ứng dụng **đặt món trực tuyến** theo mô hình monorepo gồm client và server. Điểm khác biệt là **trợ lý AI** tư vấn món ăn theo ngôn ngữ tự nhiên, gợi ý luôn nằm trong thực đơn thật và đặt được ngay.

```
┌──────────────────┐       VITE_API_URL (Bearer JWT)       ┌──────────────────────┐
│  Vite SPA client │  ───────────────────────────────────▶  │  Spring Boot server  │
│(React + antd 6)  │  ◀───────────────────────────────────  │  Java 25 + JPA       │
└──────────────────┘                                        └──────────┬───────────┘
                                                                             │
                                                       PostgreSQL 18 (ddl-auto: update)
```

- **client/**: React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + Zustand 5 + Axios + React Router 7. SPA thuần, không SSR. UI tiếng Việt. `client/src/api/http.ts` dùng `VITE_API_URL` làm `baseURL` (mặc định `http://localhost:8080/api`). Vite hiện không có proxy `/api`; nginx ở prod chỉ phục vụ static SPA và fallback route.
- **server/**: Spring Boot 3.5 (Java 25) + Spring Security (JWT access token đơn giản) + Spring Data JPA. Package gốc `com.foodordering`, layered `controller` → `service` → `repository`.
- **PostgreSQL**: `ddl-auto: update` đồng bộ schema khi khởi động (không dùng Flyway).

## Luồng dữ liệu chính

### 1. Xác thực (JWT access token)

1. Client gọi `POST /api/auth/login` hoặc `POST /api/auth/register` với email và mật khẩu.
2. Server trả về access token JWT kèm thông tin user và role (ADMIN / CUSTOMER).
3. `authStore` lưu phiên theo lựa chọn remember: `localStorage` hoặc `sessionStorage`.
4. `api/http` gắn `Authorization: Bearer <token>` cho request. Hiện interceptor chỉ đọc
   `localStorage`, nên phiên dùng `sessionStorage` cần được đồng bộ ở code trước khi dùng đầy đủ.
5. `JwtFilter` trên server đọc và verify token, dựng `SecurityContext`. Token không hợp lệ bị nuốt, request được coi là chưa đăng nhập.
6. `SecurityConfig` stateless: yêu cầu `ROLE_ADMIN` cho `/api/admin/**`; phần còn lại dùng
   `authenticated()`, trừ các matcher được khai báo `permitAll()`.

Endpoint và chính sách public hiện tại:

- `SecurityConfig` đang `permitAll()` cho toàn bộ `/api/auth/**`; các endpoint nghiệp vụ
  dùng cho đăng nhập/đăng ký là `POST /api/auth/login` và `POST /api/auth/register`.
  `/api/auth/me` cần được bảo vệ khi siết matcher.
- `GET /api/foods/**`, `/api/categories/**`, `/api/reviews/**`.
- `POST /api/chatbot/chat`: tư vấn món, khách vãng lai vẫn dùng được. Matcher hiện
  permitAll cho toàn bộ `/api/chatbot/**`.
- `POST /api/reviews` yêu cầu đăng nhập vì chỉ có matcher GET được permitAll.

Bảo vệ route trên client chỉ là UX - **quyền ADMIN được kiểm soát ở server**.

### 2. Duyệt và tìm món

- Trang danh mục gọi `GET /api/foods` và `GET /api/categories`.
- Lọc theo tên, loại, khoảng giá và trạng thái available qua query params.
- Chi tiết món gồm thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá.

### 3. Giỏ hàng (lưu theo tài khoản)

Giỏ hàng **lưu trên server** theo tài khoản (bảng `cart_items`, unique theo user + món):

- Khách đã đăng nhập: thêm/sửa/xóa/clear món qua `/api/cart/**` (yêu cầu xác thực); giỏ
  được lưu trong database và còn nguyên khi đăng nhập lại từ thiết bị khác.
- Khách vãng lai: giỏ nằm trong bộ nhớ của Zustand (không phải `localStorage` bền); khi
  đăng nhập, hệ thống đẩy bản nháp lên server rồi tải giỏ chính thức về. Khi đăng xuất,
  state giỏ của tài khoản được xóa khỏi client.
- Giá món hiển thị từ dữ liệu trả về khi duyệt món.

### 4. Đặt món (giá lấy từ DB)

1. Client gửi `POST /api/orders` với danh sách món + số lượng.
2. `OrderService.create` set `price` = giá trong DB, **không tin giá từ client**; từ chối món ngừng phục vụ.
3. Mỗi đơn được ghi một giao dịch thanh toán (`payment_transactions`: phương thức, số tiền,
   trạng thái PENDING/PAID) và tạo thông báo xác nhận cho khách (`notifications`).
4. Trạng thái đơn dùng các giá trị `PENDING`, `CONFIRMED`, `PREPARING`, `COMPLETED`, `CANCELLED`;
   trạng thái thanh toán dùng `UNPAID` hoặc `PAID`.
5. Thanh toán giả lập (COD / chuyển khoản / ví điện tử) - không tích hợp cổng thanh toán thật;
   admin ghi nhận "đã thanh toán" qua `PATCH /api/admin/orders/{id}/payment?paid=...`.
6. Khách hàng theo dõi trạng thái đơn và thông báo; admin xác nhận/cập nhật trạng thái;
   mỗi lần đổi trạng thái, khách nhận thông báo.

### 5. Trợ lý AI tư vấn món (chống bịa món/giá)

Trợ lý AI dùng **hai lượt gọi AI, bốn bước xử lý** để AI không bao giờ tự nghĩ ra món hoặc giá:

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [service/AiClient, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

- Lượt AI đầu tiên trích xuất tiêu chí dưới dạng JSON; server lọc `Food` bằng code và chỉ
  dùng các entity đang phục vụ.
- Lượt AI thứ hai viết câu trả lời từ danh sách món đã lọc và tối đa 3 đoạn tài liệu liên quan.
  Danh sách gửi vào prompt bị giới hạn 15 món; số thẻ trả về mặc định là 5 và có thể đổi
  trong cấu hình chatbot.
- Thẻ món phía client được tạo từ entity đã lọc (`FoodCard.from`), nên ID và giá không lấy
  từ câu trả lời AI.
- Lỗi AI/JSON sai thì xử lý bằng `try/catch` → tiêu chí rỗng, hệ thống vẫn chạy bình thường.
- RAG cơ bản (`KnowledgeService`) tách tài liệu thành đoạn 500 ký tự, chấm điểm theo từ khóa,
  hỗ trợ PDF/DOCX/text thuần, không cần vector DB. Admin upload tài liệu qua
  `POST /api/admin/chatbot/documents` (giới hạn request 10 MB; không có upload ảnh món).

### 6. Đánh giá và đặt lại

- Khách chỉ được đánh giá món có trong **đơn hoàn thành** của chính mình
  (`existsByUserIdAndStatusAndItemsFoodId`), khớp yêu cầu "đánh giá sau khi dùng".
- Trang lịch sử đơn có nút **Đặt lại**: đưa toàn bộ món (còn phục vụ) của đơn cũ vào giỏ,
  món ngừng phục vụ bị bỏ qua kèm cảnh báo.

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
controller/    mapping và điều phối request dưới /api/...
```

### Client (client/)

```
src/
  main.tsx         bootstrap SPA, render root
  App.tsx          layout gốc và router
  api/             lớp HTTP và hàm gọi từng endpoint
  components/      component dùng chung (ChatbotWidget...)
  data/            dữ liệu tĩnh cho trang giới thiệu/marketing
  hooks/           hook xử lý request và thao tác bất đồng bộ
  layouts/         layout dùng chung cho các nhóm route
  pages/           trang theo route (auth, foods, cart, orders, admin...)
  store/           Zustand stores (authStore, cartStore)
  types/           TS interfaces phản ánh DTO backend (giữ đồng bộ thủ công)
  utils/           hàm tiện ích dùng chung
  index.css        style gốc của SPA
index.html         entry HTML
vite.config.ts     React plugin, dev server (usePolling cho Docker; không có proxy /api)
nginx.conf         prod: serve dist/ và fallback về index.html
```

## Điểm quan trọng khi làm việc

- **Không dùng Flyway**: `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`); seed bị bỏ qua nếu `userRepo.count() > 0`.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Đồng bộ types**: `client/src/types/index.ts` phải song song với DTO server. Sửa DTO nhớ cập nhật cả hai phía.
- **AI gọi một nơi duy nhất**: `service/AiClient` là lớp DUY NHẤT gọi Gemini API (REST bằng `RestClient`, `jsonMode` ép JSON, config qua `app.ai.api-key` / `app.ai.model`). Muốn đổi nhà cung cấp AI chỉ sửa file này.
- **Ảnh món**: seed dùng ảnh demo cục bộ trong `client/public/images` (đường dẫn tương đối, resolve ở client origin). Admin có thể nhập link ảnh ngoài trong form quản lý; không có endpoint upload ảnh món.
- **`JwtFilter` nuốt exception** token không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- **Comment và tài liệu**: comment tiếng Việt nên giải thích ràng buộc, nguồn dữ liệu, vòng đời state hoặc fallback; không lặp lại cú pháp. Khi đổi hợp đồng API hoặc quy tắc domain, cập nhật đồng bộ tài liệu kiến trúc và test.

## Phát triển local (profile dev)

```bash
docker compose --profile dev up --build
```

Stack gồm postgres, server-dev và client-dev. Client truy cập tại http://localhost:5173; request API dùng `VITE_API_URL` (mặc định http://localhost:8080/api), không có Vite proxy trong cấu hình hiện tại.

- **server-dev**: mount `./server:/app`, hot reload qua `spring-boot-devtools` (restart khi file `.class` đổi). Trong container chỉ mount mã nguồn nên cần tự biên dịch: chạy `docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"` ở terminal riêng (hoặc để IDE biên dịch vào `server/target/classes`).
- **client-dev**: mount `./client:/app` (volume ngăn chặn `node_modules`), Vite HMR với `usePolling` - cập nhật ngay khi lưu file. Chỉ cần build lại image khi đổi `package.json` hoặc `Dockerfile`.
- Cache Maven dùng volume `maven_cache` chung.

## Môi trường và cấu hình

Mọi bí mật nằm trong một file `.env` duy nhất ở root (được docker-compose.yml và server đọc). Server đọc env với fallback mặc định dev (`${VAR:default}` trong application.yml). Lưu ý `mvn spring-boot:run` **không tự nạp `.env`** - phải export vars hoặc chạy qua compose.

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
| VITE_API_URL     | base URL API cho client (mặc định http://localhost:8080/api)          |

`VITE_API_URL` không phải secret. Ở profile `dev`, biến này được truyền vào container client; ở profile `prod`, nó được đưa vào lúc build Docker nên thay đổi cần rebuild image client.

Chạy toàn bộ stack: `docker compose --profile prod up --build` (production, client ở cổng 80) hoặc `docker compose --profile dev up --build` (hot reload, client ở cổng 5173). `docker compose up` (không kèm profile) chỉ khởi động Postgres.