# Tổng quan

## Một phút mô tả

FoodOrdering là một quán ăn trực tuyến. Khách vào trang chủ xem thực đơn, lọc theo danh mục, giá, khẩu phần, chế độ ăn; thêm món vào giỏ; đặt đơn với COD hoặc QR; theo dõi trạng thái và đánh giá sau khi nhận. Quản trị viên xử lý đơn, chỉnh thực đơn, tạo khuyến mãi, xem báo cáo doanh thu. Một trợ lý AI đọc câu hỏi tiếng Việt, lọc món thật trong cơ sở dữ liệu rồi mới viết câu trả lời, nên không bịa món hoặc bịa giá.

## Ba vai trò

| Vai trò | Làm được gì | Không làm được gì |
|---|---|---|
| Khách chưa đăng nhập | Xem thực đơn, xem chi tiết món, đọc đánh giá | Thêm giỏ, đặt đơn, chat, xem thông báo |
| `CUSTOMER` | Giỏ, đặt đơn, thanh toán, đánh giá, chat, hồ sơ | Vào `/admin` |
| `ADMIN` | Toàn bộ `/api/admin/**`, đọc đơn của mọi khách | Dùng giỏ và đặt đơn |

Phân quyền thật nằm ở server (`requireRole`), còn route guard phía client chỉ để điều hướng. Chi tiết ở [Kiến trúc](Kien-truc).

## Công nghệ

Phiên bản lấy từ `client/package.json` và `server/package.json`.

| Tầng | Công nghệ |
|---|---|
| Giao diện | Vue 3.5, TypeScript 6.0, Vite 8.3, Naive UI 2.45, Tailwind CSS 4 |
| State và router | Pinia 4.1, Vue Router 5.4, Axios 1.21 |
| API | Express 5.3, zod 4.6 |
| Dữ liệu | Drizzle ORM 0.45, node-postgres 8.23, PostgreSQL 18 + pgvector 0.8.7 |
| Xác thực | jsonwebtoken 9 (HS256), bcrypt 6 |
| AI | Gemini qua `@google/genai`, một lớp duy nhất ở `server/src/lib/provider.ts` |
| Kiểm thử | Vitest 5, Playwright |
| Hạ tầng | Docker Compose với 3 profile `dev`, `prod`, `tools` |

## Chức năng theo vai trò

| Chức năng | Khách | CUSTOMER | ADMIN | Trang |
|---|---|---|---|---|
| Xem và lọc thực đơn | Có | Có | Có | `/` |
| Chi tiết món | Có | Có | Có | `/foods/:id` |
| Giỏ hàng | Không | Có | Không | drawer giỏ |
| Đặt đơn, thanh toán | Không | Có | Tạo hộ | `/checkout`, `/orders` |
| Đánh giá món | Đọc | Viết | Đọc | trong chi tiết món |
| Chatbot | Không | Có | Không | widget góc phải |
| Thông báo | Không | Có | Không | chuông trên header |
| Quản lý món, danh mục | Không | Không | Có | `/admin/foods` |
| Duyệt và sửa đơn | Không | Không | Có | `/admin/orders` |
| Khuyến mãi | Không | Không | Có | `/admin/promotions` |
| Báo cáo, xuất Excel | Không | Không | Có | `/admin/reports` |
| Tài liệu chatbot | Không | Không | Có | `/admin/chatbot` |

## Cấu trúc repo

```
client/                      SPA Vue 3
  src/
    user/                    module khách hàng
      auth/ cart/ menu/ order/ payment/ profile/ review/ notification/ chatbot/
    admin/                   module quản trị
      dashboard/ menu/ order/ customer/ promotion/ report/ chatbot/
    shared/                  http.ts, message.ts, types/, utils/, stores/, theme.ts
    layouts/                 DefaultLayout.vue, AdminLayout.vue
    router/index.ts          khai báo route và guard
    composables/             useCartQuote.ts, useHasBottomBar.ts, useAsyncData.ts
  e2e/                       Playwright
  nginx.conf                 cấu hình phục vụ SPA ở prod

server/                      API Express 5
  src/
    user/                    module khách hàng, mỗi module có routes/service/schema
    admin/                   module quản trị
    middleware/              auth.ts, error.ts, rateLimit.ts
    lib/                     db, jwt, password, provider, pricing, serializers, businessTime
    config/env.ts            đọc .env bằng zod
    db/schema.ts              định nghĩa bảng
    db/seed.ts               dữ liệu demo
    app.ts                   gắn router vào /api
    server.ts                khởi động HTTP server và job quét đơn hết hạn
  drizzle/                   migration SQL
  tests/                     unit test Vitest

docker-compose.yml           Postgres, server, client theo profile
scripts/check-wiki-refs.mjs  kiểm dẫn chứng code của wiki
```

## Năm nguyên tắc chi phối toàn bộ code

1. **Tiền chỉ tính ở server.** `priceOrder` đọc giá từ bảng `foods`, áp khuyến mãi, trả về từng dòng. Client chỉ hiển thị lại con số nhận được. Xem `server/src/user/pricing/service.ts:61-115`.
2. **AI không quyết định dữ liệu.** Server lọc món bằng SQL trước, AI chỉ viết câu dựa trên danh sách đó; thẻ món lấy ID từ cơ sở dữ liệu. Xem `server/src/user/chatbot/service.ts:72-157`.
3. **Quyền kiểm ở middleware, không ở giao diện.** `adminRouter.use(requireRole("ADMIN"))` chặn cả cây `/api/admin`. Xem `server/src/admin/routes.ts:15`.
4. **Trạng thái đơn đi một chiều.** Luật chuyển trạng thái tách thành hàm thuần để test được. Xem `server/src/user/order/transitions.ts:16-31`.
5. **Một nguồn sự thật cho mỗi khái niệm.** Trạng thái, nhãn, kiểu DTO, công thức giá đều có đúng một chỗ định nghĩa; nơi khác import lại.

## Không nằm trong phạm vi

Không có thanh toán qua cổng thật: QR chỉ là bước khách bấm xác nhận, quán đối chiếu thủ công. Không có giao hàng, không có nhiều chi nhánh, không có phân quyền chi tiết hơn hai vai trò.

Tiếp theo: [Cài đặt](Cai-dat) để chạy thử, hoặc [Kiến trúc](Kien-truc) để đọc code.
