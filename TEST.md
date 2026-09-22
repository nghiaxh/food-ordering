# Hướng dẫn chạy test

Tài liệu tổng hợp cách chạy test của dự án FoodOrdering theo từng tầng:
client (unit + type), server (unit + integration) và end-to-end.

> **Lưu ý:** dự án đang ở giai đoạn **scaffolding chưa có test nào**. Các bảng dưới là
> kế hoạch framework, cấu trúc và lệnh sẽ dùng; test thật được bổ sung khi triển khai
> code chi tiết trên branch `draft` / `feat/*`.

## Tổng quan

| Tầng | Framework dự kiến | Cần Docker | Lệnh |
|------|-------------------|:---:|------|
| Client (unit) | Vitest + @testing-library/react | Không | `npm test` |
| Client (type) | tsc | Không | `npm run typecheck` |
| Server (unit + integration) | JUnit 5 + Testcontainers | Có | `mvn test` |
| E2E | Playwright (Chromium) | Không (cần stack dev đang chạy) | `npm test` (trong `e2e/`) |

---

## 1. Client tests

Chạy trong `client/`:

```bash
npm run typecheck   # tsc --noEmit — kiểm tra type
npm test            # Vitest — chạy một lần
npm run dev         # dev server, http://localhost:5173
```

Cấu hình dự kiến: `vitest.config.ts` (jsdom hoặc happy-dom, globals). Không có linter.

### Unit test dự kiến (logic thuần)

| Khu vực | Nội dung |
|---------|----------|
| `store/cartStore` | Thêm/sửa/xóa/clear giỏ, tính tổng tiền |
| `store/authStore` | Lưu/khôi phục/đăng xuất phiên JWT |
| `api/http` | Gắn `Authorization: Bearer` từ localStorage, xử lý 401 |
| `components/ChatbotWidget` | Gửi tin, render thẻ món, trạng thái loading/lỗi |

---

## 2. Server tests

Chạy trong `server/` (**bắt buộc có Docker** — Testcontainers chạy PostgreSQL thật):

```bash
mvn test      # unit + integration
```

### Unit test dự kiến (mock bean)

| Service | Nội dung |
|---------|----------|
| `AuthService` | Register (trùng email), login (sai mật khẩu, tài khoản bị khóa) |
| `FoodService` | Tìm kiếm/lọc theo từ khóa, danh mục, khoảng giá, available |
| `OrderService` | Tạo đơn, giá lấy từ DB, món ngừng phục vụ |
| `ChatbotService` | Trích xuất tiêu chí, lọc món theo cay/dị ứng/ngân sách |
| `AiClient` | Map response Gemini thành text (mock HTTP) |
| `KnowledgeService` | Tách đoạn, chấm điểm theo từ khóa |

---

## 3. E2E tests (Playwright)

Chạy trong `e2e/` — yêu cầu stack dev đang chạy tại `http://localhost:5173`:

```bash
docker compose --profile dev up --build   # từ repo root, chạy stack dev
npm install                               # (e2e/) lần đầu
npm test                                  # headless, chromium
```

Kịch bản ưu tiên:

- Luồng đặt món: đăng nhập → chọn món → giỏ hàng → đặt → xem trạng thái đơn.
- Luồng chatbot: hỏi "món Việt, không cay, 100k" → nhận thẻ món.

---

## Ghi chú

- Test server cần Docker vì Testcontainers khởi động PostgreSQL riêng; test client và E2E không cần.
- E2E cần stack dev đang chạy và dữ liệu seed (tạo tự động khi server khởi động).
- Reset dữ liệu demo bằng cách xóa volume `db_data`.