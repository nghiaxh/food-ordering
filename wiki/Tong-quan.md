FoodOrdering là web đặt món cho một quán ăn, gồm hai khu vực:

- **Khách hàng**: xem thực đơn, lọc món, thêm vào giỏ, đặt món COD hoặc QR, theo dõi đơn, đánh giá và chat với trợ lý AI.
- **Quản trị viên**: duyệt đơn, quản lý món và danh mục, khuyến mãi, khách hàng, báo cáo doanh thu và tài liệu chatbot.

## Công nghệ

| Tầng | Công nghệ |
|---|---|
| Client | Vue 3, TypeScript 6, Vite 8, Naive UI, Tailwind CSS 4, Pinia, Axios, Vue Router |
| Server | Express 5, TypeScript 6, Drizzle ORM, JWT, bcrypt, zod |
| Database | PostgreSQL 18 + pgvector (vector 768 chiều cho RAG) |
| AI | Gemini qua `server/src/lib/provider.ts` |
| Hạ tầng | Docker Compose, 3 profile `dev`, `prod`, `tools` |

## Cấu trúc repo

```
client/                  SPA Vue 3
  src/
    user/                module khách hàng: auth, menu, cart, order, review, notification, profile, chatbot
    admin/               module quản trị: dashboard, menu, order, customer, promotion, report, chatbot
    shared/              api/http, types, utils, stores, theme
    layouts/             DefaultLayout (khách), AdminLayout (quản trị)
server/                  API Express 5
  src/
    user/                module khách hàng
    admin/               module quản trị
    middleware/          auth, error, rateLimit
    lib/                 db, jwt, provider, pricing ở user/pricing, serializers
    db/                  schema, seed, migrations
  drizzle/               migration SQL
docker-compose.yml       Postgres + server + client theo profile
```

Mỗi module trong `client/src` thường có `api.ts`, `store.ts` (nếu cần) và `components/`, `pages/`. Phía server tương ứng có `routes.ts`, `service.ts`, `schema.ts`.

## Hai khu vực giao diện

- Route khách nằm trong `client/src/layouts/DefaultLayout.vue`, có header, giỏ hàng và khung chatbot.
- Route `/admin/*` nằm trong `client/src/layouts/AdminLayout.vue`, menu trái 4 nhóm và không có chatbot.

Route guard ở `client/src/router/index.ts` chỉ là UX. Quyền thật do server kiểm tra:

- `/api/admin/**` yêu cầu role `ADMIN`.
- `/api/cart/**` và `/api/orders/**` yêu cầu role `CUSTOMER`.
- Chat, hồ sơ, thông báo yêu cầu đăng nhập.

Xem chi tiết ở [Kiến trúc](Kien-truc) và [API](API).
