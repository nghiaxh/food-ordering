# Kiến trúc FoodOrdering

Mô tả ngắn gọn cách FoodOrdering vận hành và các quy ước quan trọng. Chi tiết ca kiểm thử xem [TEST.md](TEST.md).

## Tổng quan

Ứng dụng **đặt món trực tuyến** theo mô hình monorepo client–server. Điểm khác biệt: trợ lý AI
tư vấn món theo ngôn ngữ tự nhiên, gợi ý luôn nằm trong thực đơn thật và đặt được ngay.

```
┌──────────────────┐     VITE_API_URL (Bearer JWT)      ┌──────────────────────┐
│  Vite SPA client │ ─────────────────────────────────▶ │  Spring Boot server   │
│ (React + antd)   │ ◀───────────────────────────────── │  Java 25 + JPA        │
└──────────────────┘                                    └──────────┬───────────┘
                                                              PostgreSQL 18
```

- **client/**: React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + Zustand 5 + Axios + React Router 7.
  SPA thuần, UI tiếng Việt. `src/api/http.ts` đọc token từ `localStorage` rồi fallback
  `sessionStorage`, gắn `Authorization: Bearer`. Vite không có proxy `/api`; nginx ở prod chỉ
  serve static và fallback về `index.html`.
- **server/**: Spring Boot 3.5, layered `controller` → `service` → `repository`, package gốc `com.foodordering`.
- **PostgreSQL**: `ddl-auto: update`, **không dùng Flyway**. Dữ liệu mẫu nạp qua `config/DataSeeder`,
  bỏ qua toàn bộ khi bảng `users` đã có dữ liệu.

## Xác thực & phân quyền

1. `POST /api/auth/register` hoặc `/login` → JWT access token (mặc định sống 24h).
2. `JwtFilter` verify token và **tra CSDL mỗi request** (tài khoản bị khoá mất quyền ngay); exception
   bị nuốt, request được coi là chưa đăng nhập. Đừng log token.
3. `SecurityConfig` stateless; `/api/admin/**` yêu cầu `ROLE_ADMIN` (kiểm soát ở server, route guard
   client chỉ là UX). `permitAll` cho register/login, GET `/api/foods/**`, `/api/categories/**`,
   `/api/reviews/**`, `/api/uploads/**` và toàn bộ `/api/chatbot/**` (khách vãng lai vẫn chat được).
   `dispatcherTypeMatchers(ERROR).permitAll()` để lỗi 4xx/5xx không bị đổi thành 401.

## Giỏ hàng, đặt đơn, khuyến mãi

- Giỏ lưu trên server theo tài khoản (`cart_items`). Khách vãng lai giữ giỏ trong Zustand; đăng nhập
  thì đẩy giỏ nháp lên server rồi tải giỏ chính thức về.
- **Giá luôn lấy từ DB**; client không tính tiền. Mọi con số tiền đi qua `service/PricingService`:
  giỏ gọi `POST /api/cart/quote`, đơn tạo dùng chung service đó, nên báo giá và đơn đã tạo không lệch nhau.
  - Một dòng chỉ nhận **một** khuyến mãi tự động tốt nhất (hoà thì xét `priority`), không cộng dồn.
  - `QuoteLine.lineDiscount` / `OrderItem.discountAmount` là số giảm của **cả dòng** (đã × số lượng).
  - Phạm vi `GLOBAL` / `CATEGORY` / `FOOD`. Theo dịp dùng `daysOfWeek` + `startTime/endTime`
    (khung qua nửa đêm nghĩa là `start > end`). "Món may mắn" chọn theo hash
    `(foodId, promotionId, ngày)` nên cùng một ngày ai cũng thấy cùng bộ món, không cần scheduler.
  - `GET /api/foods` được `decorateFoods` điền `discountedPrice`/`discountLabel`… chỉ để hiển thị;
    con số chốt vẫn là báo giá.
- Đơn: `OrderService.create` set giá từ DB, từ chối món ngừng phục vụ. Trạng thái đi một chiều
  `PENDING → CONFIRMED → PREPARING → COMPLETED` (`CANCELLED` từ mọi trạng thái chưa chốt).
  Khách chỉ hủy được đơn `PENDING` **và** chưa thanh toán.
- Quản trị sửa đơn qua `/api/admin/orders`: đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn
  (`requireEditable`); **món chỉ sửa được khi đơn `PENDING` + `UNPAID`** (`canEditItems`); sau đó chỉ
  còn thông tin giao hàng, ghi chú và trạng thái. `AdminOrderRequest.items` được phép null.
- Người dùng chỉ đánh giá món có trong đơn `COMPLETED` của chính mình; server kiểm tra chủ sở hữu
  khi sửa/xoá đánh giá, không tin cờ `mine` từ client.
- Mã đơn hiển thị cho cả hai bên là `FO-xxxx` (`orderCode` trong `client/src/utils/orders.ts`).

## Chatbot AI (AI không bịa món/giá)

Hai lượt gọi AI, bốn bước xử lý:

```
Người dùng → (1) AI trích xuất tiêu chí (JSON)   [service/AiClient, jsonMode]
           → (2) Server truy vấn DB, lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client lấy ID/giá từ DB, không từ text AI
```

- Lượt 1 lỗi AI/JSON sai → `extractCriteria` trả `null` → lượt đó **không gợi ý món** (tiêu chí
  rỗng sẽ khớp mọi món). Lượt 2 lỗi nhưng trích xuất ok → thẻ món vẫn hiện.
- Không gọi được AI (thiếu/hỏng khoá, timeout 15s) → rơi sang `selectFoodsByCode` + `fallbackReply`:
  chấm điểm theo từ khoá trùng tên món/nguyên liệu/nhãn (không tính mô tả, không tính từng từ của
  tên danh mục), rồi áp ràng buộc đọc chắc chắn từ câu (không cay, chay, loại hải sản, ngân sách,
  số người). Câu trả lời chỉ tóm tắt một dòng, không liệt kê lại món.
- `maxBudget` là **tổng** tiền cả bữa; số phần = `ceil(người / khẩu phần)`; tổng tiền = giá × số phần.
  Số phần và tổng tiền do server tính, ghi kèm thẻ món, không giao cho AI tự tính.
- Câu hỏi kiểu "một món chính và một món uống": mỗi loại giữ 5 ứng viên rẻ nhất rồi dò tổ hợp không
  vượt ngân sách (`BudgetCombiner`). Nếu số người AI đoán quá lớn khiến không món nào vừa ngân sách,
  server thử lại bỏ yếu tố số người.
- Chỉ khách **đã đăng nhập** mới lưu lịch sử vào `chat_message`; khách vãng lai chat được nhưng
  không để dấu vết. Câu hỏi tiếp theo của cùng phiên được đưa vào ngữ cảnh lượt ghi câu trả lời.
- `AiClient` là nơi **duy nhất** gọi API AI (REST `RestClient`, `jsonMode` ép JSON, timeout 15s).
  Provider + model đọc từ bảng `ai_setting` (admin đặt trong trang Chatbot), fallback về
  `app.ai.provider` / `app.ai.model`. Hỗ trợ Gemini và OpenAI. API key chỉ ở server, không gửi xuống client.

## Ảnh

- Ảnh seed là `.webp` local trong `client/public/images` (đã resize theo ô hiển thị).
- Admin tải ảnh lên: `POST /api/admin/uploads/image` (JPG/PNG/WEBP ≤ 2 MB, kiểm **chữ ký đầu file**,
  không tin Content-Type). File lưu ở `app.upload.dir`, phục vụ công khai tại `/api/uploads/**`,
  trả URL **tuyệt đối** nên không cần sửa nginx.

## Giao diện

- Hai layout riêng: `DefaultLayout` (khách: thanh điều hướng + chatbot nổi) và `AdminLayout`
  (`/admin/*`, menu trái, không có chatbot). Route admin không nằm trong `DefaultLayout`.
- Thực đơn là trang chủ `/`; `/foods/:id` là **route con** hiện thành Drawer phủ
  (không rời bảng món, URL thật, nút back đóng được panel). `/foods` chuyển hướng về `/`.
  Bộ lọc nằm trên URL (`category`, `keyword`, `min`, `max`), đọc bằng `useSearchParams`.
- Header cao `3.25rem`; đổi thì sửa cả `top-[3.25rem]` của chatbot và `100dvh-3.25rem` của FoodsPage.
- `components/UiButton.tsx` là nút dùng chung, chỉ 6 dạng (`primary`, `primary-lg`, `default`,
  `danger`, `icon`, `fab`); chiều cao ghi bằng tiền tố `!` vì AntD nạp CSS-in-JS sau Tailwind.
- Chatbot nổi bám trang: `fixed inset-x-0 bottom-0 top-[3.25rem]` + `justify-end`, vùng trống
  `pointer-events-none`. `useHasCartBar()` chỉ tính `/` và `/cart` (và chỉ khi giỏ có món).
- Doanh thu trên Dashboard và trang Báo cáo đều là doanh thu **sau giảm giá**, cùng nguồn
  `/api/admin/reports/*` (mặc định 30 ngày gần nhất) nên không lệch nhau.

## Cấu trúc mã nguồn

```
server/src/main/java/com/foodordering/
  config/  cấu hình (AppProperties, DataSeeder, WebConfig, SecurityConfig)
  security/ JwtUtil, JwtFilter
  entity/  JPA entities
  repository/  Spring Data JPA repositories
  dto/     request/response (đồng bộ thủ công với types client)
  service/ nghiệp vụ (OrderService, CartService, PricingService, PromotionService,
           ChatbotService, AiClient, ReportService, AuthService, FoodService)
  controller/  mapping dưới /api/...

client/src/
  main.tsx  App.tsx(router)  api/  store/(Zustand)  types/  components/
  pages/    layouts/  hooks/  utils/  index.css
```

Sửa DTO phải cập nhật cả `client/src/types/index.ts` và `client/src/api/api.ts`.

## Môi trường & chạy

Bí mật nằm trong một file `.env` ở root (copy từ `.env.example`): `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`. Compose tự dựng
`DB_URL`; `AI_PROVIDER` mặc định `gemini`, `UPLOAD_DIR=/app/uploads` trong container.
`mvn spring-boot:run` **không tự đọc `.env`** — phải export tay hoặc chạy qua compose.

- Dev: `docker compose --profile dev up --build` (client http://localhost:5173, server :8080)
- Prod: `docker compose --profile prod up --build -d` (client http://localhost)
- `docker compose up` (không profile): chỉ Postgres.
- Server dev hot reload: trong container chỉ mount mã nguồn nên cần terminal riêng chạy
  `docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"`
  (hoặc để IDE biên dịch vào `server/target/classes`). Client dev dùng Vite HMR, không cần build lại
  image trừ khi đổi `package.json`.

## Kiểm thử

Server có 3 test class (`PricingServiceTest`, `ChatbotServiceTest`, `OrderDtosValidationTest`),
chạy độc lập không cần DB. Client chưa có test runner; kiểm tra bằng `npm run typecheck` và `npm run build`.

## Quy tắc quan trọng khi làm việc

- Không Flyway; schema do Hibernate `ddl-auto: update` tự đồng bộ.
- Seed chỉ chạy khi bảng `users` trống; đổi dữ liệu mẫu thì DB cũ giữ nguyên — reset bằng
  `docker compose --profile prod down -v`.
- Mọi quy tắc giảm giá sửa ở `PricingService`, đừng tính lại ở React.
- Sửa endpoint/DTO/quy tắc domain → cập nhật đồng bộ `AGENTS.md`, `ARCHITECTURE.md`, `TEST.md`.
- Không giữ bí mật trong code; chỉ trong `.env`.
