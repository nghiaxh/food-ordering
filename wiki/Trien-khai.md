## Chạy production bằng Docker Compose

```bash
cp .env.example .env
# điền JWT_SECRET và AI_API_KEYS
docker compose --profile prod up --build -d
```

Kết quả:

- Client tại http://localhost (Nginx phục vụ SPA).
- API tại http://localhost:8080/api.
- Postgres tại localhost:5432.

Service `client-prod` chờ `server-prod` healthy rồi mới chạy, nên lần đầu mất khoảng 30 giây.

## Thành phần

| Service | Vai trò |
|---|---|
| `database` | PostgreSQL 18 + pgvector, luôn chạy |
| `server-prod` | API Express đã build |
| `client-prod` | Nginx phục vụ file tĩnh |
| `server-dev`, `client-dev` | Chỉ profile `dev`, có hot reload |
| `drizzle-studio` | Chỉ profile `tools` |

## Biến môi trường production

Bắt buộc:

- `JWT_SECRET`: tối thiểu 32 ký tự.
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

Tuỳ chọn:

- `JWT_EXPIRATION_MS`
- `AI_API_KEYS`
- `AI_MODELS`
- `EMBEDDING_MODELS`
- `ORDER_PAYMENT_TIMEOUT_MINUTES`
- `UPLOAD_DIR` (compose đặt `/app/uploads`)

Compose tự dựng `DATABASE_URL` từ `DB_*`.

## Ảnh tải lên

- File lưu trong volume `uploads`, mount vào `/app/uploads`.
- Phục vụ công khai tại `/api/uploads/**`.
- Endpoint upload trả URL tuyệt đối, nên không cần sửa Nginx.
- Volume phải được giữ lại khi deploy lại; xoá volume sẽ mất ảnh đã tải.

## pgvector

- Image bắt buộc: `pgvector/pgvector:0.8.7-pg18`.
- Migration tạo extension `vector` trước khi thêm cột `vector(768)`.
- Chỉ số HNSW dùng `vector_cosine_ops`.
- Volume cũ cùng major Postgres 18 dùng lại được.

## Dữ liệu và seed

- Server tự seed khi bảng `users` còn trống.
- Database đã có dữ liệu thì seed bị bỏ qua, kể cả khi đổi dữ liệu mẫu.
- Reset toàn bộ dữ liệu demo:

```bash
docker compose --profile prod down -v
docker compose --profile prod up --build -d
```

`down -v` xoá cả volume database và ảnh tải lên. Cân nhắc trước khi chạy trên môi trường thật.

## Kiểm tra sau khi deploy

1. `GET http://localhost:8080/api/categories` trả 200.
2. Mở client, đăng nhập bằng tài khoản demo.
3. `GET /api/chatbot/status` trả `available = true` nếu khoá AI hợp lệ.
4. Tải một ảnh món từ trang quản trị và mở URL trả về.

Nếu chatbot báo `available = false`, kiểm tra `AI_API_KEYS`. Kết quả kiểm tra khoá được giữ trong bộ nhớ, nên thay khoá phải khởi động lại server.
