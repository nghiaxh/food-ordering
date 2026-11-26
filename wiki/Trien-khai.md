# Triển khai

## Ba profile

Một file `docker-compose.yml`, ba profile:

| Profile | Chạy gì | Dùng khi |
|---|---|---|
| `prod` | db + server-prod + client-prod | Demo và production |
| `dev` | db + server-dev + client-dev với volume mount, hot reload | Phát triển |
| `tools` | Drizzle Studio | Kiểm tra DB |

Service `database` không khai báo `profiles`, nên Postgres luôn chạy theo mọi profile và cả khi gọi `docker compose up` không profile (`docker-compose.yml:2-6`).

## Lệnh

```bash
# Phát triển
docker compose --profile dev up --build

# Production / demo
docker compose --profile prod up --build -d

# Drizzle Studio
docker compose --profile tools up -d
```

## Image và volume

- Postgres: `pgvector/pgvector:0.8.7-pg18` (hỗ trợ pgvector).
- Dữ liệu DB trong volume `db_data`.
- Ảnh tải lên trong volume `uploads`, mount vào `/app/uploads`.
- Compose tự dựng `DATABASE_URL` từ `DB_NAME`; `UPLOAD_DIR=/app/uploads`.

## CI/CD

`.github/workflows/ci.yml`: push/PR vào `main` chạy typecheck + build cho client và server, плюс e2e với stack dev. `.github/workflows/publish-wiki.yml` mirror `wiki/` sang GitHub Wiki khi push vào `main`, chạy `scripts/check-wiki-refs.mjs` trước.

## Healthcheck và thời gian khởi động

`client-dev`/`client-prod` chờ `condition: service_healthy`, server chờ database healthy (`docker-compose.yml:72-74`). Lần đầu chậm khoảng 30 giây là đúng. Đừng bỏ healthcheck.

## Biến môi trường production

Đọc từ `.env` ở root. Tên khớp cấu hình server: `DB_USER`/`DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEYS`, `AI_MODELS`, `EMBEDDING_MODELS`, `ORDER_PAYMENT_TIMEOUT_MINUTES`.

`JWT_SECRET` phải có ít nhất 32 ký tự, nếu không server thoát (`server/src/config/env.ts:26`).

## Reset toàn bộ

```bash
docker compose --profile prod down -v
docker compose --profile prod up --build -d
```

`down -v` xoá cả database và ảnh đã tải lên.

Tiếp theo: [Xử lý sự cố](Xu-ly-su-co).
