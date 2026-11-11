# AGENTS.md - FoodOrdering

Web đặt món tích hợp Chatbot AI tư vấn món ăn (niên luận ngành). Monorepo
client-server, không có build tooling ở root; `client/` và `server/` build độc lập.

## Kiến trúc

- **client/** - Vue 3 (Composition API, `<script setup>`) + TypeScript, Vite, Naive UI,
  Tailwind CSS 4, Pinia, Axios, Vue Router. SPA thuần, không SSR. Cấu trúc `modules/` theo
  module chức năng (`modules/auth/`, `modules/menu/`...), mỗi module gồm `api.ts`, `store.ts`
  (nếu có store) và `components/`, `pages/`; hạ tầng dùng chung ở `shared/` (`api/http.ts`,
  `types/`, `utils/`, `stores/`). Toast/message dùng naive-ui (`createDiscreteApi`). UI tiếng Việt.
- **server/** - Express 5 + TypeScript, Drizzle ORM (node-postgres), PostgreSQL 18.
  JWT bằng `jsonwebtoken` (HS256) + `bcrypt`; validate đầu vào bằng `zod`. Cấu trúc `src/modules/`
  theo module chức năng giống client, lớp chính `src/server.ts`; middleware tập trung ở
  `src/middleware/` (auth, error), tiện ích ở `src/lib/`.
- **AI** - `server/src/lib/gemini.ts` là lớp DUY NHẤT gọi API AI (REST bằng `fetch`, `jsonMode` ép
  JSON, timeout 15s). Hỗ trợ Gemini và OpenAI; nhà cung cấp + tên mô hình đọc từ bảng `ai_setting`
  do admin đặt trong trang Chatbot, fallback về `AI_PROVIDER` / `AI_MODEL`. Muốn thêm
  nhà cung cấp thứ ba chỉ sửa file này. Khóa API lấy từ `AI_API_KEY`, không gửi xuống client.
- **Infra** - `docker-compose.yml` 1 file, 3 profile: `prod` (db + server-prod +
  client-prod), `dev` (db + server-dev + client-dev với volume mount, hot reload) và `tools`
  (Drizzle Studio).
  Server dev reload nhờ `tsx watch` (không cần bước compile riêng).
  Một file `.env` duy nhất ở root chứa mọi bí mật; compose tự dựng `DATABASE_URL`.

### Chatbot - hai lượt gọi AI, bốn bước chống AI bịa món/giá

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [gemini.ts, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

AI **không bao giờ** được tự nghĩ ra món/giá. Prompt truy vấn món chỉ nhận danh sách
có sẵn từ `modules/menu`; nếu lỗi AI/JSON sai thì `service.ts` extractCriteria trả `null` và
`chat()` chuyển sang nhánh dự phòng. Đừng coi `null` là tiêu chí rỗng: tiêu chí rỗng
khớp mọi món, danh sách ra là vài món rẻ nhất không liên quan gì tới câu hỏi, khách hỏi
món chay lại nhận cà phê đá. Chỉ khách **đã đăng nhập** mới ghi lịch sử hội thoại; khách
vãng lai chat được nhờ `history`/`lastFoodIds` client gửi kèm, không lưu vào DB.

**Cách áp tiêu chí** (`modules/chatbot/select.ts (selectFoods)`): lọc thuộc tính món trước (còn phục
vụ, độ cay, thành phần loại trừ, nhãn chế độ ăn, từ khóa), rồi mới chọn món theo ngân
sách. `maxBudget` là **TỔNG** tiền của cả bộ gợi ý, không phải giá một món. Số phần cần
tính theo khẩu phần (`ceil(people / servingSize)`) và tổng tiền là `giá × số phần`; đừng
so `maxBudget` với giá một phần. Có ngân sách thì `FlatBudgetPicker` (0/1 nhóm, tối đa 20
ứng viên rẻ nhất) hoặc `BudgetCombiner` (≥2 nhóm) chọn 1..5 món sao cho tổng `totalPrice`
không vượt hạn mức; không có bộ nào vừa thì trả rỗng và câu trả lời nói rõ. `categories`
là danh sách loại món kèm số lượng, dùng cho câu hỏi kiểu "một món chính và một món uống".
Mỗi lượt trả tối đa **5 thẻ**; `maxSuggestions()` kẹp cấu hình về 1..5 kể cả giá trị cũ 8/10.
Số phần và tổng tiền phải tính ở server và gửi kèm thẻ món, không giao cho AI tự tính.

**Nhánh dự phòng khi không gọi được AI** (429/5xx, hết thời gian chờ, JSON hỏng):
`chat()` rơi sang `select.ts` selectFoodsByCode + `select.ts` fallbackReply. Món được chấm điểm bằng code theo
từ khóa trùng tên món/nguyên liệu/nhãn (không tính mô tả món, không tính từng từ của tên
danh mục), rồi áp ràng buộc đọc chắc chắn từ câu: không cay, chay, loại trừ hải sản, ngân
sách, số người. Câu trả lời chỉ tóm tắt một dòng rồi mời khách bấm thẻ món, **không** liệt
kê lại danh sách món (thẻ món đã hiện bên dưới) - luật 9 của prompt AI cũng cấm AI làm vậy.
Câu hỏi ngoài lề không gợi ý món nào. Thẻ món vẫn lấy ID/giá từ DB nên không có chuyện
AI bịa món.

**Câu hỏi tiếp**: client gửi `history` (3 câu gần nhất) và `lastFoodIds` (món ở tin bot
gần nhất). Server chỉ dùng `lastFoodIds` khi câu có cụm tham chiếu rõ ("món đó", "cái đó",
"món này", "món vừa gợi ý", "mấy món trên", "trong số đó") và tiêu chí không mở chủ đề mới
(`categories`/`keywords`/`dietaryTags`/`excludeAllergens`); khi đó lấy đúng `Food` theo ID
và áp ràng buộc mới. Không dùng độ dài câu để đoán hỏi tiếp. Nhánh dự phòng khi AI lỗi cũng
bám context này.

**Thiếu hoặc hỏng khóa AI**: `lib/gemini.ts` isConfigured() false khi `AI_API_KEY` rỗng **hoặc** nhà
cung cấp đã từ chối khóa (401/403, hay 400 kèm `API_KEY_INVALID` của Gemini); cờ "bị từ chối"
giữ tới khi khởi động lại server. `GET /api/chatbot/status` gọi `verifyKey()`: lần đầu thử một
câu tối giản với nhà cung cấp rồi nhớ kết quả, nên mở trang là biết khóa sai ngay chứ không đợi
lượt chat đầu tiên; lỗi mạng/quota thì coi như dùng được và chỉ thử lại sau 5 phút. Khi không
dùng được, `chat()` ném `503 SERVICE_UNAVAILABLE` với câu "Trợ lý AI chưa được cấu hình, vui lòng
thử lại sau." **trước khi** lưu câu hỏi hay chọn món, và status trả `available = false` (không
bao giờ trả khóa) để client khóa ô nhập, hiện banner. Lỗi tạm thời mới rơi sang nhánh code ở trên.

### Key wiring (không rõ từ tên file)

- **Không dùng Flyway.** Schema do Drizzle ORM (`drizzle-kit`) quản lý (`server/drizzle/`);
  seed nạp qua `server/src/db/seed.ts`, bỏ qua nếu bảng `users` đã có dữ liệu,
  nên không nhân đôi dữ liệu demo khi chạy lại.
- **Security**: middleware stateless `requireAuth`/`optionalAuth`/`requireRole` ở
  `src/middleware/auth.ts`, không session. Public: `/api/auth/register`,
  `/api/auth/login`, GET `/api/foods/**` `/api/categories/**` `/api/reviews/**`
  `/api/uploads/**` và toàn bộ `/api/chatbot/**` (khách vãng lai vẫn chat được);
  `/api/admin/**` yêu cầu role `ADMIN`; `/api/cart/**`, `/api/orders`, `/api/orders/**` yêu cầu
  role `CUSTOMER`; phần còn lại cần đăng nhập. Mọi lỗi đi qua `middleware/error.ts` và trả
  `{ message }` tiếng Việt với đúng mã 4xx/5xx, không lộ chi tiết nội bộ.
  Token sinh bằng `src/lib/jwt.ts`, middleware tra CSDL mỗi request để tài khoản bị
  khoá mất quyền ngay. CORS mở cho demo.
- **Giá luôn lấy từ DB**: `modules/order` `createOrder` set `price` = giá trong DB, không tin client.
- **Giỏ bắt buộc đăng nhập**: khách vãng lai không có giỏ local; ở thẻ chatbot nút thêm món bị
  khoá kèm tooltip "Đăng nhập để thêm món vào giỏ" (NTooltip trong thẻ chatbot), ở thẻ món
  trang thực đơn thì bấm nút dấu cộng sẽ được đưa sang `/login`; `/checkout` nằm trong
  requireAuth còn `/cart` chỉ chuyển hướng về `/checkout`. Giỏ mở bằng drawer toàn cục
  (`modules/cart/components/CartDrawer.vue`), khách bấm giỏ khi chưa đăng nhập được đưa sang `/login` kèm cờ
  `openCart` để mở lại sau khi đăng nhập. `cartStore.add` trả `Promise<boolean>` và từ chối khi
  chưa đăng nhập. Store thay dòng optimistic
  bằng `CartItem` server trả để món thêm từ chatbot có đủ field và giá đúng; response chỉ được áp
  theo số thứ tự request của từng món. `CartItem.quantity` mặc định `1`, nên `cart` module tạo
  dòng mới với `quantity = 0` trước khi cộng, không thì lần thêm đầu tiên dư 1 phần.
- **Tiền chỉ tính ở `modules/pricing` (server)**: `POST /api/cart/quote` nhận `{ items }` đúng danh sách dòng
  client đang hiển thị và tính bằng `priceOrder`; lúc tạo đơn dùng chung module này. Quote **không
  đọc lại giỏ DB** để response cũ không ghi đè giỏ mới. Client không nhân phần trăm hay trừ khuyến
  mãi, chỉ hiện lại `QuoteLine.lineDiscount` (số tiền giảm của **cả dòng**). Mỗi dòng chỉ nhận một
  khuyến mãi tự động tốt nhất. `composables/useCartQuote.ts` là nơi duy nhất gọi quote, dùng chung cho
  drawer giỏ và `/checkout`.
- **Sửa đơn ở quản trị**: món chỉ sửa được khi đơn `PENDING` **và** `UNPAID` (`order` module `canEditItems`);
  đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn kể cả thông tin giao hàng (kiểm trong `adminUpdateOrder`);
  các
  trạng thái còn lại chỉ sửa được người nhận/SĐT/địa chỉ/ghi chú/trạng thái. `adminOrderSchema.items`
  được phép null, còn `adminCreate` tự kiểm danh sách món không rỗng. Khách cũng chỉ hủy được đơn
  `PENDING` + chưa thanh toán; client ẩn nút bằng `canCancelOrder` trong `client/src/shared/utils/orders.ts`.

- **Nhãn PREPARING là "Đang vận chuyển"**: mã trạng thái trong DB không đổi, chỉ đổi nhãn hiển thị
  (`ORDER_STATUS_LABEL`, `order` module, thông báo "đang được vận chuyển"); nút admin
  `CONFIRMED → PREPARING` là "Giao hàng", nút **Đặt lại** ở `/orders` chỉ hiện khi `COMPLETED`.
- **Ràng buộc biên**: mật khẩu ≥ 8 ký tự, SĐT `^0\d{9}$`, giỏ không nhận món ngừng phục vụ,
  trạng thái đơn đi đúng một chiều, không khoá/xoá tài khoản quản trị. Chi tiết và cách kiểm
  từng mục nằm trong `TEST.md`.
- **Types client phải đồng bộ với DTO server** (thủ công). Sửa DTO nhớ cập nhật
  `client/src/shared/types/index.ts` và file `api.ts` của module tương ứng.
- **Ảnh món** trong seed dùng file local dưới `client/public/images/foods/`; admin tải ảnh
  lên qua `POST /api/admin/uploads/image` (JPG/PNG/WEBP, ≤ 2 MB, kiểm bằng chữ ký đầu file
  chứ không tin Content-Type) hoặc dán URL ngoài trong form. File lưu ở `UPLOAD_DIR`
  (volume `uploads`) và phục vụ tại `/api/uploads/**`; endpoint trả URL **tuyệt đối** nên
  không cần sửa nginx.
- **Giao diện kiểu kiosk**: thực đơn là trang chủ `/`, có hero ngắn, dải danh mục ảnh và
  "Ưu đãi hôm nay" trước lưới món. Chi tiết món là **trang riêng** `/foods/:id` trong
  `DefaultLayout` (không còn Drawer hay route con). Bộ lọc của trang chủ nằm trên URL (`category`,
  `keyword`, `min`, `max`, `sort`, `diet`, `spicy`, `available`, `deal`, `page`), đọc bằng
  `useRoute().query`. Lưới món giữ 2 cột dưới `md`, 4 cột từ `md`, mỗi trang 12 món và phân trang
  số trang. Vị trí cuộn lưới lưu ở `sessionStorage['menu-scroll']`, nút quay lại của
  trang chi tiết dùng `state.from` để giữ nguyên query.
- **Nút bấm**: dùng trực tiếp `NButton` của Naive UI; không viết wrapper nút mới. Không ghi đè
  chiều cao bằng class `!h-*` đi ngược lại chiều cao mặc định của naive-ui.
- **Thanh điều hướng một hàng ở mọi kích thước**: logo (`BrandMark`, bấm về `/`), ô tìm kiếm
  co giãn, nút đơn hàng, nút giỏ, avatar/nút đăng nhập. Từ `lg` chuông và đơn hàng có nút riêng
  trên header (chuông mang chấm đỏ chưa đọc); dưới `lg` hai mục này nằm trong menu tài khoản
  và mở drawer tương ứng. Nút đơn hàng (icon `ReceiptOutline` cho khách, `GridOutline` cho admin)
  chỉ hiện từ `lg` khi đã đăng nhập vì
  `/orders` cần token; đừng thêm menu điều hướng, các trang con còn lại nằm trong menu tài khoản.
  Trang đăng nhập/đăng ký (`AuthShell`) không hiển thị thương hiệu/link về bảng món.
- **Chiều cao header là `--header-h` (`3.25rem`)** trong `index.css`; khối chatbot dùng
  `top-[var(--header-h)]`, vùng cuộn của `FoodsPage` dùng `calc(100dvh-var(--header-h))`. Đổi
  chiều cao chỉ sửa biến, đừng hard-code lại ở ba nơi. Trang chi tiết dùng
  `lg:top-[calc(var(--header-h)+1rem)]` cho ảnh sticky, checkout dùng cột tóm tắt sticky
  với cùng giá trị.
- **Chatbot mở bằng `shared/stores/uiStore.ts`** (`chatOpen`), không còn state cục bộ, để hero và empty
  state mở được; nút làm mới hội thoại xoá ngữ cảnh cũ và cấp `sessionId` mới. Bốn điểm vào
  (`GREETING_STARTERS`) chỉ hiện khi hội thoại còn mới; `quickReplies` do server quyết định
  nằm dưới tin bot mới nhất, tin cũ bị tước `quickReplies` giống `foods`.
- **Chatbot chỉ giữ thẻ của tin bot mới nhất** (tối đa 5); tin bot cũ vẫn còn chữ nhưng mất
  `foods`, nên khung chat không dồn thẻ. Không còn nút "Xem thực đơn" trong khung chat. Nút
  thêm món trong thẻ chatbot yêu cầu đăng nhập: khách vãng lai thấy nút disabled kèm tooltip
  và bấm không điều hướng theo link của thẻ. Nút dấu cộng trên thẻ món ở trang thực đơn thì
  không disable: khách vãng lai bấm được và được đưa sang `/login`.
- **Cụm chatbot bám trang** bằng `fixed inset-x-0 bottom-0 top-[var(--header-h)]` + `justify-end`,
  khung chat
  `flex-1` nên tự co theo màn hình. Không hard-code chiều cao khung chat bằng `100dvh - Xrem`,
  cách đó dễ trượt khi header đổi kích thước. Vùng trống của cụm có `pointer-events-none` nên
  không chặn bấm vào thẻ món.
- **Ảnh local phải là `.webp`**: `client/public/images` chỉ chứa webp, không có `.jpg`.
  Đường dẫn ảnh nằm trong DB (`food.image_url`, `category.image_url`) nên đổi định dạng phải
  sửa `server/src/db/seed.ts` **và** chạy `UPDATE ... WHERE right(image_url,4) = '.jpg'`; seeder bị bỏ qua
  khi DB đã có dữ liệu. Cỡ ảnh theo ô hiển thị: `foods` 1200px, `categories` 800px,
  `hero` 1280px (hero vốn đã blur + opacity nên quality thấp vẫn đẹp).

## Commands

Chạy trong `client/` hoặc `server/` (không có script ở root).

**Client** (`./client`):
- Dev server: `npm run dev` (http://localhost:5173)
- Build: `npm run build` (vue-tsc --noEmit + vite build → `dist/`)
- Typecheck: `npm run typecheck` (vue-tsc --noEmit). Không có lint target; kiểm tra bằng typecheck + build.
- E2E: `npm run test:e2e` (Playwright, spec ở `client/e2e/`). Cần stack dev đang chạy; CI không chạy job này.
- API client dùng `VITE_API_URL` làm `baseURL`; `vite.config.ts` không có proxy `/api`.

**Server** (`./server`):
- Dev: `npm run dev` (tsx watch, http://localhost:8080/api; cần Postgres ở localhost:5432
  và biến môi trường từ root `.env` — server tự đọc qua dotenv; hoặc `docker compose --profile dev up --build`)
- Build/test: `npm run build` / `npm test` / `npm run typecheck`. Unit test Vitest trong `tests/`, chạy độc lập không cần DB.
- Migration CSDL: `npm run db:generate` (tạo migration), `npm run db:migrate` (áp dụng), `npm run db:seed` (nạp demo), `npm run db:studio` (mở Drizzle Studio).
- Prod: `docker compose --profile prod up --build -d`

**Full stack** (repo root):
- Prod: `docker compose --profile prod up --build`
- Dev: `docker compose --profile dev up --build`
- `docker compose up` (không profile) chỉ khởi động Postgres.
- Compose tự dựng `DATABASE_URL` từ `DB_NAME`; `AI_PROVIDER` mặc định `gemini`, `UPLOAD_DIR=/app/uploads`.
  Các biến còn lại đọc từ `.env`, tên khớp cấu hình server (`DB_USER`/`DB_PASSWORD`, `JWT_SECRET`,
  `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`).

## Quy ước comment và tài liệu

- Comment mới dùng **tiếng Việt không dấu**, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
- Quy ước này chỉ áp cho **comment trong mã** (`client/src`, `server/src`, `server/tests`).
  Chuỗi hiển thị cho người dùng, prompt AI, dữ liệu seed và thông báo lỗi vẫn viết có dấu.
- Khi đổi endpoint, DTO, quy tắc domain hoặc luồng nghiệp vụ, cập nhật đồng bộ
  `ARCHITECTURE.md`, `TEST.md` và tài liệu liên quan. Khi đổi quy ước phân nhánh
  hoặc commit, cập nhật đồng bộ `BRANCHING.md`.

## Phân nhánh và Git

- Không làm việc trực tiếp trên `main` (không commit, không push thẳng lên `main`).
- Luôn đồng bộ trước khi tách branch: `git checkout main` rồi `git pull origin main`.
- Mọi thay đổi tách từ `main` thành branch riêng: `feat/<ten>`, `fix/<ten>`,
  `docs/<ten>`, `refactor/<ten>`, `test/<ten>`. Không dùng `dev` hay `draft`.
- Mở PR ngược về `main`, merge bằng squash merge để lịch sử gọn. Chi tiết xem `BRANCHING.md`.
- Commit theo Conventional Commits, dùng tiếng Anh: `<type>[optional scope]: <description>`,
  lowercase, imperative, no period. Một commit một mục đích, một commit một loại thay đổi.
- Không commit, push hay rewrite history trừ khi user yêu cầu rõ ràng.

## Gotchas

- **`.env` bắt buộc** và chứa mọi bí mật (DB, JWT, Gemini). Copy từ `.env.example` →
  `.env`. `.gitignore` đã chặn `.env` ở root.
- **`docker compose up` lần đầu chậm ~30s là đúng**: `client-dev`/`client-prod` chờ
  `condition: service_healthy`, mà server cần thời gian cài deps + khởi động Node. Trước đó client
  gọi vào cổng 8080 đã publish nhưng chưa có backend nên ra `net::ERR_EMPTY_RESPONSE`. Đừng bỏ
  healthcheck để "nhanh hơn".
- UI tiếng Việt (`lang: vi`). Giữ chuỗi giao diện và thông báo lỗi bằng tiếng Việt.
- **Quyền ADMIN kiểm soát ở server** bằng middleware (`requireRole('ADMIN')` trên `/api/admin/**`),
  không chỉ dựa vào ẩn menu client. Route guard client chỉ là UX.
- **Hot reload server**: `tsx watch` tự restart khi file trong `src/` đổi — không cần bước compile riêng.
- **Lưu ý phiên đăng nhập:** `authStore` hỗ trợ `localStorage` và `sessionStorage`;
  `client/src/shared/api/http.ts` đọc token từ `localStorage` rồi fallback `sessionStorage`, nên ô
  "Ghi nhớ đăng nhập" hoạt động đúng cả hai chế độ.
- **Hai layout riêng**: route khách nằm trong `DefaultLayout`, route `/admin/*` nằm trong
  `AdminLayout` (menu trái 4 nhóm / 8 mục, không có khung chatbot). Thêm route admin mới thì nhớ khai
  báo trong `AdminLayout`, đừng gắn vào `DefaultLayout`.
- **`useHasBottomBar` tính theo đường dẫn**: chỉ `/checkout` có thanh đặt món, và chỉ khi giỏ
  còn món. Trang mới có thanh cố định đáy
  thì phải cập nhật hook, nếu không nút mở chatbot sẽ bị thanh che. Hai drawer giỏ/thông báo
  dùng `activeDrawer` trong `uiStore` để không chồng mask.
- `requireAuth`/`optionalAuth` bọc lỗi không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- **Seed bị bỏ qua nếu DB đã có user.** Đổi dữ liệu mẫu (ví dụ mật khẩu demo) thì database cũ
  vẫn giữ giá trị cũ; reset bằng `docker compose --profile prod down -v` rồi `up` lại.
- **`AI_API_KEY` trong `.env` phải là khóa thật.** Để trống, sai hoặc hết hạn thì trợ lý bị khóa
  hẳn ngay khi mở trang: `/api/chatbot/status` trả `available = false`, khung chat hiện banner và
  khóa ô nhập. Đó là hành vi dự kiến chứ không phải lỗi code. Muốn demo luồng có gợi ý món thì
  phải thay khoá thật rồi khởi động lại server (kết quả kiểm tra khóa cũ được giữ trong bộ nhớ).
- Không giữ bí mật trong code hoặc trong file commit - chỉ trong `.env`.