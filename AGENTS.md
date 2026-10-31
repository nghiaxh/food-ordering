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
có sẵn từ `FoodRepository`; nếu lỗi AI/JSON sai thì `extractCriteria` trả `null` để hệ
thống vẫn chạy, và `chat()` **không gợi ý món** cho lượt đó. Đừng đổi `null` thành tiêu
chí rỗng: tiêu chí rỗng khớp mọi món, danh sách ra là vài món rẻ nhất không liên quan
gì tới câu hỏi, khách hỏi món chay lại nhận cà phê đá. Chỉ khách **đã đăng nhập**
mới ghi lịch sử hội thoại; khách vãng lai chat được nhưng để dấu vết rỗng.

**Cách áp tiêu chí** (`ChatbotService.selectFoods`): lọc thuộc tính món trước (còn phục
vụ, độ cay, thành phần loại trừ, nhãn chế độ ăn, từ khóa), rồi mới chọn món theo ngân
sách. `maxBudget` là **TỔNG** tiền của cả bữa, không phải giá một món. Số phần cần tính
theo khẩu phần (`ceil(people / servingSize)`) và tổng tiền là `giá × số phần`; đừng so
`maxBudget` với giá một phần. `categories` là danh sách loại món kèm số lượng, dùng cho
câu hỏi kiểu "một món chính và một món uống". Số phần và tổng tiền phải tính ở server và
gửi kèm thẻ món, không giao cho AI tự tính.

**Nhánh dự phòng khi không gọi được AI** (thiếu/hỏng khóa, hết thời gian chờ):
`chat()` rơi sang `selectFoodsByCode` + `fallbackReply`. Món được chấm điểm bằng code theo
từ khóa trùng tên món/nguyên liệu/nhãn (không tính mô tả món, không tính từng từ của tên
danh mục), rồi áp ràng buộc đọc chắc chắn từ câu: không cay, chay, loại trừ hải sản, ngân
sách, số người. Câu trả lời chỉ tóm tắt một dòng rồi mời khách bấm thẻ món, **không** liệt
kê lại danh sách món (thẻ món đã hiện bên dưới) - luật 9 của prompt AI cũng cấm AI làm vậy.
Câu hỏi ngoài lề không gợi ý món nào. Thẻ món vẫn lấy ID/giá từ DB nên không có chuyện
AI bịa món.

### Key wiring (không rõ từ tên file)

- **Không dùng Flyway.** `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập
  nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`); seed bị bỏ qua
  nếu `userRepo.count() > 0`, nên không nhân đôi dữ liệu demo khi chạy lại.
- **Security**: `SecurityConfig` stateless, hiện `permitAll()` cho toàn bộ `/api/auth/**`,
  GET `/api/foods/**` `/api/categories/**` `/api/reviews/**`, và toàn bộ `/api/chatbot/**`
  (khách vãng lai vẫn chat được); `/api/admin/**` yêu cầu `ROLE_ADMIN`; phần còn lại
  `authenticated()`. Token sinh bằng `JwtUtil`, lọc bằng `JwtFilter`. CORS mở cho demo.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Tiền chỉ tính ở `PricingService`**: `POST /api/cart/quote` và lúc tạo đơn dùng chung một
  service. Client không nhân phần trăm hay trừ khuyến mãi, chỉ hiện lại `QuoteLine.lineDiscount`
  (số tiền giảm của **cả dòng**). Mỗi dòng chỉ nhận một khuyến mãi tự động tốt nhất.
- **Sửa đơn ở quản trị**: món chỉ sửa được khi đơn `PENDING` **và** `UNPAID`; đơn
  `COMPLETED`/`CANCELLED` khoá hoàn toàn (`OrderService.requireEditable`). `AdminOrderRequest.items`
  được phép null để sửa thông tin giao hàng, còn `adminCreate` tự kiểm danh sách món không rỗng.
  Khách cũng chỉ hủy được đơn `PENDING` + chưa thanh toán.
- **Ràng buộc biên**: mật khẩu ≥ 8 ký tự, SĐT `^0\d{9}$`, giỏ không nhận món ngừng phục vụ,
  trạng thái đơn đi đúng một chiều, không khoá/xoá tài khoản quản trị. Chi tiết và cách kiểm
  từng mục nằm trong `TEST.md`.
- **Types client phải đồng bộ với DTO server** (thủ công). Sửa DTO nhớ cập nhật
  `client/src/types/index.ts` và `client/src/api/api.ts`.
- **Ảnh món** trong seed dùng file local dưới `client/public/images/foods/`; admin tải ảnh
  lên qua `POST /api/admin/uploads/image` (JPG/PNG/WEBP, ≤ 2 MB, kiểm bằng chữ ký đầu file
  chứ không tin Content-Type) hoặc dán URL ngoài trong form. File lưu ở `app.upload.dir`
  (volume `uploads`) và phục vụ tại `/api/uploads/**`; endpoint trả URL **tuyệt đối** nên
  không cần sửa nginx.
- **Giao diện kiểu kiosk**: thực đơn là trang chủ `/`, chi tiết món là **route con** `/foods/:id`,
  hiện thành Drawer phủ (không phải trang riêng) để không rời bảng món và dùng chung bố cục. Bộ lọc của trang này nằm trên URL (`category`, `keyword`,
  `min`, `max`), đọc bằng `useSearchParams`.
- **Nút bấm dùng `components/UiButton.tsx`**, chỉ 6 dạng `primary`, `primary-lg`, `default`,
  `danger`, `icon`, `fab`; prop tên là `kind` vì AntD đã dùng `variant` cho kiểu nút. Không tự
  viết class nút mới. **Đừng ghi đè kích thước bằng class.** Hai class `!h-*` có cùng độ ưu
  tiên nên Tailwind quyết định theo thứ tự sinh CSS, không phải thứ tự truyền vào, nên
  truyền `className="!h-9"` lên nút có preset `!h-10` sẽ **không** có tác dụng. Muốn nhỏ lại
  thì truyền `size="small"`; bảng `HEIGHTS` trong UiButton đã tính sẵn.
- **Chiều cao nút phải ghi bằng tiền tố `!`** (`!h-11`): AntD nạp CSS-in-JS sau Tailwind và
  sẽ ghi đè chiều cao, nút chatbot từng bị vì thế mà chỉ còn 40px.
- **Thanh điều hướng có 5 thành phần** (nút trang chủ, ô tìm kiếm, đơn hàng, giỏ, đăng nhập)
  theo Bảng 2.22. Logo **không** nằm ở thanh điều hướng; trang đăng nhập/đăng ký (`AuthShell`)
  không còn hiển thị thương hiệu/link về bảng món. Nút đơn hàng (icon `inbox`)
  chỉ hiện khi đã đăng nhập vì `/orders` cần token; đừng thêm menu điều hướng, các trang con còn
  lại nằm trong menu tài khoản. Header cao `3.25rem`; đổi chiều cao này thì sửa luôn
  `top-[3.25rem]` của khối chatbot và `100dvh-3.25rem` ở `FoodsPage`, nếu không khung chat sẽ
  tràn lên header hoặc bảng món bị hụt dải phía dưới.
- **Cụm chatbot bám trang** bằng `fixed inset-x-0 bottom-0 top-[3.25rem]` + `justify-end`,
  khung chat
  `flex-1` nên tự co theo màn hình. Không hard-code chiều cao khung chat bằng `100dvh - Xrem`,
  cách đó dễ trượt khi header đổi kích thước. Vùng trống của cụm có `pointer-events-none` nên
  không chặn bấm vào thẻ món.
- **Ảnh local phải là `.webp`**: `client/public/images` chỉ chứa webp, không có `.jpg`.
  Đường dẫn ảnh nằm trong DB (`food.image_url`, `category.image_url`) nên đổi định dạng phải
  sửa `DataSeeder` **và** chạy `UPDATE ... WHERE right(image_url,4) = '.jpg'`; seeder bị bỏ qua
  khi DB đã có dữ liệu. Cỡ ảnh theo ô hiển thị: `foods` 1200px, `categories` 800px,
  `hero` 1280px (hero vốn đã blur + opacity nên quality thấp vẫn đẹp).

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
  `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `UPLOAD_DIR`.

## Quy ước comment và tài liệu

- Comment mới dùng tiếng Việt, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
- Khi đổi endpoint, DTO, quy tắc domain hoặc luồng nghiệp vụ, cập nhật đồng bộ
  `ARCHITECTURE.md`, `TEST.md` và tài liệu liên quan.

## Quy ước comment và tài liệu

- Comment mới dùng tiếng Việt, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
- Khi đổi endpoint, DTO, quy tắc domain hoặc luồng nghiệp vụ, cập nhật đồng bộ
  `ARCHITECTURE.md`, `TEST.md` và tài liệu liên quan.

## Gotchas

- **`.env` bắt buộc** và chứa mọi bí mật (DB, JWT, Gemini). Copy từ `.env.example` →
  `.env`. `.gitignore` đã chặn `.env` ở root.
- **`docker compose up` lần đầu chậm ~30s là đúng**: `client-dev`/`client-prod` chờ
  `condition: service_healthy`, mà server cần ~28s (mvn compile + Spring Boot). Trước đó client
  gọi vào cổng 8080 đã publish nhưng chưa có backend nên ra `net::ERR_EMPTY_RESPONSE`. Đừng bỏ
  healthcheck để "nhanh hơn".
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