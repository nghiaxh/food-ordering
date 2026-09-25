# Hướng dẫn kiểm tra và test

Tài liệu này ghi rõ các kiểm tra đang có của FoodOrdering và lộ trình bổ sung test cho
client, server và end-to-end.

> **Trạng thái hiện tại:** dự án chưa có test tự động. `client/package.json` chưa có script
> `npm test`, `server/src/test/` chưa tồn tại và thư mục `e2e/` chưa được tạo. `mvn test`
> hiện build thành công nhưng báo không có test source.

## Tổng quan

| Hạng mục | Trạng thái | Cần Docker | Lệnh |
|----------|------------|:----------:|------|
| Client typecheck | Có | Không | `cd client && npm run typecheck` |
| Client build | Có | Không | `cd client && npm run build` |
| Server compile/test | Có, hiện có 0 test | Không | `cd server && mvn test` |
| Client unit test | Chưa cài đặt | Không | Dự kiến: Vitest + Testing Library |
| Server unit/integration | Chưa cài đặt | Có khi dùng Testcontainers | Dự kiến: JUnit 5 + Testcontainers |
| E2E | Chưa cài đặt | Cần stack chạy | Dự kiến: Playwright trong `e2e/` |

## Kiểm tra hiện có

Chạy từ thư mục tương ứng:

```bash
# Client: kiểm tra TypeScript và build Vite
cd client
npm run typecheck
npm run build

# Server: compile, chạy test hiện có và đóng gói
cd ../server
mvn test
mvn package
```

Hiện tại không có linter, Vitest, test source hoặc test E2E. Không chạy `npm test` ở client
vì script này chưa được khai báo.

## 1. Client tests (kế hoạch)

Khi bổ sung Vitest và `@testing-library/react`, có thể dùng cấu hình `vitest.config.ts`
với `jsdom` hoặc `happy-dom`. Các test nên tập trung vào logic dễ lỗi:

| Khu vực | Nội dung dự kiến |
|---------|------------------|
| `store/cartStore` | Thêm/sửa/xóa/clear giỏ, hợp nhất giỏ khách và rollback khi API lỗi |
| `store/authStore` | Lưu/khôi phục/đăng xuất phiên JWT |
| `api/http` | Gắn `Authorization: Bearer` và xử lý 401 |
| `hooks/useAsyncData` | Hủy request cũ, retry lỗi mạng và chống response stale |
| `hooks/useAsyncAction` | Khóa submit kép và trạng thái pending |
| `components/ChatbotWidget` | Gửi tin, retry, render thẻ món và lỗi request |

## 2. Server tests (kế hoạch)

Khi bổ sung JUnit 5 và Testcontainers, chạy từ `server/`:

```bash
mvn test
```

Docker chỉ bắt buộc khi các integration test thực sự dùng Testcontainers để khởi động
PostgreSQL. `mvn test` ở trạng thái hiện tại không cần Docker.

Các test dự kiến:

| Service | Nội dung |
|---------|----------|
| `AuthService` | Đăng ký trùng email, login sai mật khẩu, tài khoản bị khóa |
| `FoodService` | Tìm kiếm/lọc theo từ khóa, danh mục, khoảng giá và available |
| `OrderService` | Tạo đơn, giá lấy từ DB, từ chối món ngừng phục vụ |
| `ChatbotService` | Trích xuất tiêu chí, lọc món và fallback khi JSON/AI lỗi |
| `AiClient` | Ánh xạ response Gemini thành text bằng HTTP mock |
| `KnowledgeService` | Tách đoạn 500 ký tự và chấm điểm theo từ khóa |

## 3. E2E tests (kế hoạch)

Khi tạo thư mục `e2e/` và thêm Playwright, chạy stack dev trước:

```bash
docker compose --profile dev up --build   # từ repo root
cd e2e
npm install
npm test
```

Kịch bản ưu tiên:

- Luồng đặt món: đăng nhập → chọn món → giỏ hàng → đặt → theo dõi đơn.
- Luồng chatbot: hỏi "món Việt, không cay, 100k" → nhận câu trả lời và thẻ món thật.

## Ghi chú vận hành

- Dữ liệu demo được seed khi bảng `user` còn trống; xóa volume `db_data` để reset.
- Khi thêm test framework hoặc test source, cập nhật lại bảng trạng thái và lệnh tại đây.
- Không coi kết quả `mvn test` hiện tại là bằng chứng đã có kiểm thử nghiệp vụ; lệnh đang
  chủ yếu kiểm tra compile.
