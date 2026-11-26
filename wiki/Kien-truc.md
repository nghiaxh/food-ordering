## Client

SPA thuần, không SSR, dùng Vue 3 Composition API và `<script setup>`.

```
client/src/
  user/          auth, menu, cart, order, review, notification, profile, chatbot
  admin/         dashboard, menu, order, customer, promotion, report, chatbot
  shared/
    api/http.ts  Axios instance, gắn token, chuẩn hoá lỗi
    api/message.ts  toast dùng chung (tối đa 3)
    types/       DTO đồng bộ thủ công với server
    utils/       format tiền, ngày, trạng thái đơn, validator
    stores/      uiStore (drawer, chatbot)
  layouts/       DefaultLayout và AdminLayout
  router/        khai báo route và guard UX
```

Quy ước:

- Mỗi module có `api.ts` gọi endpoint và `store.ts` nếu cần state dùng chung.
- Toast lấy từ `shared/api/message.ts`, không dùng `useMessage()`.
- Type trong `shared/types/index.ts` phải sửa cùng lúc với DTO server.

## Server

Express 5 + TypeScript, chia module giống client.

```
server/src/
  user/          module khách hàng
  admin/         module quản trị
  middleware/    auth (requireAuth, optionalAuth, requireRole), error, rateLimit
  lib/           db, jwt, password, provider, serializers, businessTime, validate
  config/env.ts  đọc và kiểm tra biến môi trường bằng zod
  app.ts         gắn router vào /api
  server.ts      khởi động HTTP server và job quét đơn hết hạn
```

Mỗi module thường có:

- `routes.ts`: khai báo endpoint, middleware và parse input.
- `service.ts`: nghiệp vụ và truy vấn Drizzle.
- `schema.ts`: zod schema cho body/query.

`server/src/app.ts` gắn toàn bộ router. Mọi lỗi đi qua `middleware/error.ts` và trả `{ message }` tiếng Việt với mã 4xx/5xx phù hợp.

## Xác thực và phân quyền

- Đăng ký/đăng nhập ở `server/src/user/auth/routes.ts`, mật khẩu băm bằng bcrypt.
- Token JWT HS256 sinh ở `server/src/lib/jwt.ts`.
- `server/src/middleware/auth.ts` đọc `Authorization: Bearer <token>`, xác thực chữ ký rồi **tra CSDL mỗi request**. Nhờ vậy tài khoản bị khoá mất quyền ngay, không cần chờ token hết hạn.
- `requireAuth` bắt buộc đăng nhập, `optionalAuth` chỉ gắn người dùng nếu token hợp lệ, `requireRole('ADMIN' | 'CUSTOMER')` kiểm tra vai trò.

Phía client, token được lưu ở `localStorage` hoặc `sessionStorage`; `shared/api/http.ts` đọc `localStorage` trước rồi fallback `sessionStorage`. Đăng nhập mặc định chỉ lưu phiên ở `sessionStorage`; ô "Ghi nhớ đăng nhập" chỉ lưu email, không lưu mật khẩu và không kéo dài hạn token.

## Tiền và khuyến mãi

Tiền chỉ tính ở server trong `server/src/user/pricing/`:

- `service.ts` cung cấp `priceOrder`, `decorateFoods`, `markUsed`.
- `engine.ts` chọn khuyến mãi tốt nhất cho từng dòng.

Client gọi `POST /api/cart/quote` qua `client/src/composables/useCartQuote.ts` và chỉ hiển thị lại số tiền server trả. Khi tạo đơn, server tính lại từ đầu trong `createOrder`; giá trong `order_items` lấy từ CSDL, không tin client.

Mỗi dòng chỉ nhận một khuyến mãi tự động tốt nhất. Khuyến mãi phạm vi `CATEGORY`/`FOOD` phải có `targetIds`; `usageLimit = 0` nghĩa là không giới hạn.

## Ngày giờ báo cáo

`server/src/lib/businessTime.ts` `parseBusinessRange` đọc `from`/`to`:

- Chuỗi `"YYYY-MM-DD"` là ngày lịch Việt Nam (đầu ngày đến cuối ngày theo giờ Việt).
- Chuỗi ISO datetime giữ nguyên instant.
- Ngày sai hoặc `from > to` trả 400.

Client gửi `"YYYY-MM-DD"` và hiển thị bằng `dayLabel` để không lệch ngày theo múi giờ máy.

## CSDL

- Schema Drizzle ở `server/src/db/schema.ts`, quan hệ ở `relations.ts`.
- Migration SQL trong `server/drizzle/`.
- Seed trong `server/src/db/seed.ts`, bỏ qua nếu bảng `users` đã có dữ liệu.
- Postgres dùng image `pgvector/pgvector:0.8.7-pg18`; extension `vector` và cột `vector(768)` phục vụ RAG.

Xem luồng cụ thể ở [Luồng khách hàng](Luong-khach-hang), [Đặt món và thanh toán](Luong-dat-mon), [Chatbot](Luong-chatbot).
