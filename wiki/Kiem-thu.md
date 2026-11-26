# Kiểm thử

## Lệnh

```bash
# Server unit test (Vitest, không cần DB)
cd server
npm test

# Server typecheck
npm run typecheck

# Server build
npm run build

# Client typecheck + build
cd client
npm run typecheck
npm run build

# Client E2E (Playwright, cần stack dev đang chạy)
npm run test:e2e
```

CI chạy typecheck và build cho cả hai phía (`client` và `server` job), плюс e2e job dựng stack dev bằng compose. Xem `.github/workflows/ci.yml`.

## Unit test server

Vitest trong `server/tests/`, chạy độc lập không cần database. Các nhóm:

| File | Phủ gì |
|---|---|
| `orderLifecycle.test.ts` | Luật chuyển trạng thái đơn |
| `orderExpiry.test.ts` | Hết hạn đơn QR |
| `orderSchema.test.ts`, `adminOrderSchema.test.ts` | Validate đơn |
| `pricing.test.ts` | Tính tiền và khuyến mãi |
| `promotionSchema.test.ts` | Validate khuyến mãi |
| `chatbotConstraints.test.ts` | Đọc tiêu chí chatbot |
| `chatbotIntent.test.ts` | Ý định chatbot |
| `chatbotGrounding.test.ts` | Dọn câu trả lời |
| `chatbotSessions.test.ts` | Lịch sử hội thoại |
| `providerModels.test.ts` | Xoay model |
| `reportRange.test.ts` | Parse ngày báo cáo |
| `textNormalizer.test.ts` | Chuẩn hoá teencode |

## E2E client

Playwright spec trong `client/e2e/`: `auth`, `chatbot`, `notifications`, `ordering`, `reviews`. Cần stack dev đang chạy. Khi `AI_API_KEYS` rỗng thì 2 ca chatbot cần AI tự skip, các ca còn lại vẫn chạy.

## Kiểm dẫn chứng wiki

```bash
node scripts/check-wiki-refs.mjs
```

Kiểm tra file tồn tại, khoảng dòng hợp lệ, link nội bộ không chết, không em dash, không chữ Hán.

## Điều không có

- Không có lint target ở client. Kiểm tra bằng typecheck + build.
- Không có test framework cho component Vue; chỉ build + typecheck.
- Không có integration test chạm database.

Tiếp theo: [Triển khai](Trien-khai).
