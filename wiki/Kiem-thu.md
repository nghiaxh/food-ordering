## Lệnh kiểm tra

### Client

```bash
cd client
npm run typecheck   # vue-tsc --noEmit
npm run build       # typecheck + vite build
npm run test:e2e    # Playwright, cần stack dev đang chạy
```

Không có lint target; kiểm tra bằng typecheck và build.

### Server

```bash
cd server
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsc -p tsconfig.build.json
```

Unit test nằm trong `server/tests/`, không cần database.

## Unit test hiện có

```
server/tests/
  chatbotConstraints.test.ts
  chatbotGrounding.test.ts
  chatbotIntent.test.ts
  chatbotSessions.test.ts
  orderExpiry.test.ts
  orderLifecycle.test.ts
  orderSchema.test.ts
  adminOrderSchema.test.ts
  pricing.test.ts
  promotionSchema.test.ts
  providerModels.test.ts
  reportRange.test.ts
  textNormalizer.test.ts
```

Các nhóm chính:

- Chatbot: đọc tiêu chí, chặn câu ngoài phạm vi, giới hạn câu, phiên hội thoại.
- Đơn hàng: vòng đời trạng thái, hết hạn QR, schema tạo/sửa đơn.
- Giá và khuyến mãi: engine chọn khuyến mãi, schema khuyến mãi.
- Báo cáo: đọc khoảng ngày theo giờ Việt.
- Provider: xoay model khi lỗi.

## E2E

Spec nằm trong `client/e2e/`:

```
auth.spec.ts
ordering.spec.ts
reviews.spec.ts
notifications.spec.ts
chatbot.spec.ts
```

Chạy local:

```bash
cd client
npm run test:e2e
```

Cần stack dev đang chạy (`docker compose --profile dev up --build`).

## CI

Workflow: `.github/workflows/ci.yml`, chạy khi push lên `main`, mở PR vào `main`, hoặc chạy tay.

| Job | Nội dung |
|---|---|
| `client` | `npm ci`, typecheck, build |
| `server` | `npm ci`, typecheck, `npm test`, build |
| `e2e` | Dựng stack dev bằng Docker Compose, chờ service sẵn sàng, chạy Playwright |

Job `e2e` dùng `AI_API_KEYS` rỗng. Hai ca chatbot cần AI sẽ tự skip; các ca còn lại vẫn chạy. Khi lỗi, workflow in log container và tải `playwright-report`.

## Kiểm tra trước khi mở PR

1. `cd server && npm run typecheck && npm test && npm run build`
2. `cd client && npm run typecheck && npm run build`
3. Nếu đổi luồng giao diện: chạy `npm run test:e2e` với stack dev.
4. Kiểm tra `git diff` không chứa `.env`, khoá hay dữ liệu bí mật.
