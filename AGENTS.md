# AGENTS.md - FoodOrdering

Web đặt món tích hợp Chatbot AI tư vấn món ăn (niên luận ngành). Monorepo
client-server, không có build tooling ở root; `client/` và `server/` build độc lập.

## Kiến trúc

- **client/** - React + TypeScript, Vite, Ant Design, Zustand, Axios, React Router.
  SPA thuần, không SSR. App code trong `src/` (`main.tsx` + `App.tsx` + `api/` +
  `store/` + `types/` + `components/` + `pages/`). Toast/message dùng AntD trực tiếp.
  UI tiếng Việt.
- **server/** - Spring Boot 3.5 (Java 25), Maven, Spring Security + JWT (access token
  đơn giản), Spring Data JPA, PostgreSQL 18. Package gốc `com.foodordering`, lớp chính
  `FoodOrderingApplication`. Layered: `controller` → `service` → `repository`; `config`,
  `security`, `entity`, `dto` mỗi thư mục riêng.
- **AI** - `service/AiClient` là lớp DUY NHẤT gọi Gemini API (REST bằng `RestClient`,
  `jsonMode` ép JSON). Muốn đổi nhà cung cấp AI chỉ sửa file này. Config qua
  `AppProperties` (`app.ai.api-key`, `app.ai.model`).
- **Infra** - `docker-compose.yml` 1 file, 2 profile: `prod` (db + server-prod +
  client-prod) và `dev` (db + server-dev + client-dev với volume mount, hot reload).
  Server dev reload nhờ `spring-boot-devtools` + tự `mvn compile` (xem Gotchas).
  Một file `.env` duy nhất ở root chứa mọi bí mật; cả compose và `application.yml`
  đều đọc theo cùng tên biến.

### Chatbot - hai lượt gọi AI, bốn bước chống AI bịa món/giá

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [AiClient, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

AI **không bao giờ** được tự nghĩ ra món/giá. Prompt truy vấn món chỉ nhận danh sách
có sẵn từ `FoodRepository`; nếu lỗi AI/JSON sai thì `try/catch` → tiêu chí rỗng để hệ
thống vẫn chạy. RAG cơ bản (`KnowledgeService`) tách tài liệu thành đoạn 500 ký tự,
chấm điểm theo từ khóa, hỗ trợ PDF/DOCX/text thuần, không cần vector DB.

### Key wiring (không rõ từ tên file)

- **Không dùng Flyway.** `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập
  nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`); seed bị bỏ qua
  nếu `userRepo.count() > 0`, nên không nhân đôi dữ liệu demo khi chạy lại.
- **Security**: `SecurityConfig` stateless, hiện `permitAll()` cho toàn bộ `/api/auth/**`,
  GET `/api/foods/**` `/api/categories/**` `/api/reviews/**`, và toàn bộ `/api/chatbot/**`
  (khách vãng lai vẫn chat được); `/api/admin/**` yêu cầu `ROLE_ADMIN`; phần còn lại
  `authenticated()`. Token sinh bằng `JwtUtil`, lọc bằng `JwtFilter`. CORS mở cho demo.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Types client phải đồng bộ với DTO server** (thủ công). Sửa DTO nhớ cập nhật
  `client/src/types/index.ts`.
- **Ảnh món** trong seed dùng file local dưới `client/public/images/foods/`; admin có thể
  nhập link ảnh ngoài trong form, không có endpoint upload ảnh món (chỉ upload tài liệu chatbot).

## Commands

Chạy trong `client/` hoặc `server/` (không có script ở root).

**Client** (`./client`):
- Dev server: `npm run dev` (http://localhost:5173)
- Build: `npm run build` (tsc --noEmit + vite build → `dist/`)
- Typecheck: `npm run typecheck` (tsc --noEmit). Không có lint target.
- API client dùng `VITE_API_URL` làm `baseURL`; `vite.config.ts` không có proxy `/api`.

**Server** (`./server`):
- Dev: `docker compose --profile dev up --build` từ repo root (postgres + server-dev +
  client-dev, hot reload), hoặc `mvn spring-boot:run` (cần Postgres ở localhost:5432
  và nạp các biến từ `.env` - Maven không tự đọc `.env`)
- Build/test: `mvn package` / `mvn test`. Hiện chưa có test source, nên `mvn test`
  chủ yếu kiểm tra compile.
- Prod: `docker compose --profile prod up --build -d`

**Full stack** (repo root):
- Prod: `docker compose --profile prod up --build`
- Dev: `docker compose --profile dev up --build`
- `docker compose up` (không profile) chỉ khởi động Postgres.
- Tên biến trong compose khớp `application.yml`: `DB_URL`/`DB_USER`/`DB_PASSWORD`,
  `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`.

## Quy ước comment và tài liệu

- Comment mới dùng tiếng Việt, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
- Khi đổi endpoint, DTO, quy tắc domain hoặc luồng nghiệp vụ, cập nhật đồng bộ
  `ARCHITECTURE.md`, `TEST.md` và tài liệu liên quan.

## Gotchas

- **`.env` bắt buộc** và chứa mọi bí mật (DB, JWT, Gemini). Copy từ `.env.example` →
  `.env`. `.gitignore` đã chặn `.env` ở root.
- UI tiếng Việt (`lang: vi`). Giữ chuỗi giao diện và thông báo lỗi bằng tiếng Việt.
- **Quyền ADMIN kiểm soát ở server** bằng HTTP (`hasRole("ADMIN")` trên `/api/admin/**`),
  không chỉ dựa vào ẩn menu client. Route guard client chỉ là UX.
- **Hot reload server**: `spring-boot-devtools` restart khi file `.class` đổi. Trong
  container chỉ mount mã nguồn nên cần biên dịch: chạy `docker compose --profile dev exec
  server-dev sh -c "while true; do mvn -q compile; sleep 3; done"` ở một terminal khác
  (hoặc để IDE biên dịch vào `server/target/classes`).
- **Lưu ý phiên đăng nhập:** `authStore` hỗ trợ `localStorage` và `sessionStorage`, nhưng
  `client/src/api/http.ts` hiện chỉ đọc token từ `localStorage`; lựa chọn không nhớ đăng nhập
  cần được đồng bộ ở code trước khi xem là hoạt động đầy đủ.
- `SecurityConfig` hiện dùng `permitAll()` cho toàn bộ `/api/auth/**`; không mô tả
  `/api/auth/me` là endpoint bắt buộc đăng nhập cho đến khi siết matcher.
- `JwtFilter` nuốt exception không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- Không giữ bí mật trong code hoặc trong file commit - chỉ trong `.env`.