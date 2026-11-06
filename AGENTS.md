# AGENTS.md - FoodOrdering

Web đặt món tích hợp Chatbot AI tư vấn món ăn (niên luận ngành). Monorepo
client-server, không có build tooling ở root; `client/` và `server/` build độc lập.

## Kiến trúc

- **client/** - React + TypeScript, Vite, Ant Design, Zustand, Axios, React Router.
  SPA thuần, không SSR. App code trong `src/` (`main.tsx` + `App.tsx` + `api/` +
  `store/` + `types/` + `components/` + `pages/`). Toast/message dùng AntD trực tiếp.
  UI tiếng Việt.
- **server/** - Spring Boot 3.5 (Java 21), Maven, Spring Security + JWT (access token
  đơn giản), Spring Data JPA, PostgreSQL 18. Package gốc `com.foodordering`, lớp chính
  `FoodOrderingApplication`. Layered: `controller` → `service` → `repository`; `config`,
  `security`, `entity`, `dto` mỗi thư mục riêng.
- **AI** - `service/AiClient` là lớp DUY NHẤT gọi API AI (REST bằng `RestClient`, `jsonMode` ép
  JSON, timeout 15s). Hỗ trợ Gemini và OpenAI; nhà cung cấp + tên mô hình đọc từ bảng `ai_setting`
  do admin đặt trong trang Chatbot, fallback về `app.ai.provider` / `app.ai.model`. Muốn thêm
  nhà cung cấp thứ ba chỉ sửa file này. Khóa API lấy từ `app.ai.api-key`, không gửi xuống client.
- **Infra** - `docker-compose.yml` 1 file, 2 profile: `prod` (db + server-prod +
  client-prod) và `dev` (db + server-dev + client-dev với volume mount, hot reload).
  Server dev reload nhờ `spring-boot-devtools` + tự `mvn compile` (xem Gotchas).
  Một file `.env` duy nhất ở root chứa mọi bí mật; cả compose và `application.yml`
  đều đọc theo cùng tên biến.

### Chatbot - hai lượt gọi AI, bốn bước chống AI bịa món/giá

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [AiClient, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

AI **không bao giờ** được tự nghĩ ra món/giá. Prompt truy vấn món chỉ nhận danh sách
có sẵn từ `FoodRepository`; nếu lỗi AI/JSON sai thì `extractCriteria` trả `null` và
`chat()` chuyển sang nhánh dự phòng. Đừng coi `null` là tiêu chí rỗng: tiêu chí rỗng
khớp mọi món, danh sách ra là vài món rẻ nhất không liên quan gì tới câu hỏi, khách hỏi
món chay lại nhận cà phê đá. Chỉ khách **đã đăng nhập** mới ghi lịch sử hội thoại; khách
vãng lai chat được nhờ `history`/`lastFoodIds` client gửi kèm, không lưu vào DB.

**Cách áp tiêu chí** (`ChatbotService.selectFoods`): lọc thuộc tính món trước (còn phục
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
`chat()` rơi sang `selectFoodsByCode` + `fallbackReply`. Món được chấm điểm bằng code theo
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

**Thiếu hoặc hỏng khóa AI**: `AiClient.isConfigured()` false khi `AI_API_KEY` rỗng **hoặc** nhà
cung cấp đã từ chối khóa (401/403, hay 400 kèm `API_KEY_INVALID` của Gemini); cờ "bị từ chối"
giữ tới khi khởi động lại server. `GET /api/chatbot/status` gọi `verifyKey()`: lần đầu thử một
câu tối giản với nhà cung cấp rồi nhớ kết quả, nên mở trang là biết khóa sai ngay chứ không đợi
lượt chat đầu tiên; lỗi mạng/quota thì coi như dùng được và chỉ thử lại sau 5 phút. Khi không
dùng được, `chat()` ném `503 SERVICE_UNAVAILABLE` với câu "Trợ lý AI chưa được cấu hình, vui lòng
thử lại sau." **trước khi** lưu câu hỏi hay chọn món, và status trả `available = false` (không
bao giờ trả khóa) để client khóa ô nhập, hiện banner. Lỗi tạm thời mới rơi sang nhánh code ở trên.

### Key wiring (không rõ từ tên file)

- **Không dùng Flyway.** `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập
  nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`); seed bị bỏ qua
  nếu `userRepo.count() > 0`, nên không nhân đôi dữ liệu demo khi chạy lại.
- **Security**: `SecurityConfig` stateless, `permitAll()` cho `/api/auth/register`,
  `/api/auth/login` (matcher không giới hạn method), GET `/api/foods/**` `/api/categories/**` `/api/reviews/**`
  `/api/uploads/**` và toàn bộ `/api/chatbot/**` (khách vãng lai vẫn chat được);
  `/api/admin/**` yêu cầu `ROLE_ADMIN`; phần còn lại `authenticated()`.
  **Phải có `dispatcherTypeMatchers(ERROR).permitAll()`**: thiếu dòng này thì mọi lỗi
  400/404/500 đều bị đổi thành 401 khi Tomcat dispatch sang `/error`.
  Token sinh bằng `JwtUtil`, lọc bằng `JwtFilter` (tra CSDL mỗi request để tài khoản bị
  khoá mất quyền ngay). CORS mở cho demo.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Giỏ bắt buộc đăng nhập**: khách vãng lai không có giỏ local; nút thêm món bị khoá kèm tooltip
  "Đăng nhập để thêm món vào giỏ" (`components/LoginTooltip.tsx`), `/checkout` nằm trong
  `RequireAuth` còn `/cart` chỉ chuyển hướng về `/checkout`. Giỏ mở bằng drawer toàn cục
  (`components/CartDrawer.tsx`), khách bấm giỏ khi chưa đăng nhập được đưa sang `/login` kèm cờ
  `openCart` để mở lại sau khi đăng nhập. `cartStore.add` trả `Promise<boolean>` và từ chối khi
  chưa đăng nhập. Store thay dòng optimistic
  bằng `CartItem` server trả để món thêm từ chatbot có đủ field và giá đúng; response chỉ được áp
  theo số thứ tự request của từng món. `CartItem.quantity` mặc định `1`, nên `CartService.add` phải
  tạo dòng mới với `quantity = 0` trước khi cộng, không thì lần thêm đầu tiên dư 1 phần.
- **Tiền chỉ tính ở `PricingService`**: `POST /api/cart/quote` nhận `{ items }` đúng danh sách dòng
  client đang hiển thị và tính bằng `priceOrder`; lúc tạo đơn dùng chung service này. Quote **không
  đọc lại giỏ DB** để response cũ không ghi đè giỏ mới. Client không nhân phần trăm hay trừ khuyến
  mãi, chỉ hiện lại `QuoteLine.lineDiscount` (số tiền giảm của **cả dòng**). Mỗi dòng chỉ nhận một
  khuyến mãi tự động tốt nhất. `hooks/useCartQuote.ts` là nơi duy nhất gọi quote, dùng chung cho
  drawer giỏ và `/checkout`.
- **Sửa đơn ở quản trị**: món chỉ sửa được khi đơn `PENDING` **và** `UNPAID` (`OrderService.canEditItems`);
  đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn kể cả thông tin giao hàng (`requireEditable`); các
  trạng thái còn lại chỉ sửa được người nhận/SĐT/địa chỉ/ghi chú/trạng thái. `AdminOrderRequest.items`
  được phép null, còn `adminCreate` tự kiểm danh sách món không rỗng. Khách cũng chỉ hủy được đơn
  `PENDING` + chưa thanh toán; client ẩn nút bằng `canCancelOrder` trong `client/src/utils/orders.ts`.

- **Nhãn PREPARING là "Đang vận chuyển"**: mã trạng thái trong DB không đổi, chỉ đổi nhãn hiển thị
  (`ORDER_STATUS_LABEL`, `OrderService.label`, thông báo "đang được vận chuyển"); nút admin
  `CONFIRMED → PREPARING` là "Giao hàng", nút **Đặt lại** ở `/orders` chỉ hiện khi `COMPLETED`.
- **Ràng buộc biên**: mật khẩu ≥ 8 ký tự, SĐT `^0\d{9}$`, giỏ không nhận món ngừng phục vụ,
  trạng thái đơn đi đúng một chiều, không khoá/xoá tài khoản quản trị. Chi tiết và cách kiểm
  từng mục nằm trong `TEST.md`.
- **Types client phải đồng bộ với DTO server** (thủ công). Sửa DTO nhớ cập nhật
  `client/src/types/index.ts` và `client/src/api/api.ts`.
- **Ảnh món** trong seed dùng file local dưới `client/public/images/foods/`; admin tải ảnh
  lên qua `POST /api/admin/uploads/image` (JPG/PNG/WEBP, ≤ 2 MB, kiểm bằng chữ ký đầu file
  chứ không tin Content-Type) hoặc dán URL ngoài trong form. File lưu ở `app.upload.dir`
  (volume `uploads`) và phục vụ tại `/api/uploads/**`; endpoint trả URL **tuyệt đối** nên
  không cần sửa nginx.
- **Giao diện kiểu kiosk**: thực đơn là trang chủ `/`, có hero ngắn, dải danh mục ảnh và
  "Ưu đãi hôm nay" trước lưới món. Chi tiết món là **trang riêng** `/foods/:id` trong
  `DefaultLayout` (không còn Drawer hay route con). Bộ lọc của trang chủ nằm trên URL (`category`,
  `keyword`, `min`, `max`, `sort`, `diet`, `spicy`, `available`, `deal`, `page`), đọc bằng
  `useSearchParams`. Lưới món giữ 2 cột dưới `md`, 4 cột từ `md`, mỗi trang 12 món và phân trang
  số trang. Vị trí cuộn lưới lưu ở `sessionStorage['menu-scroll']`, nút quay lại của
  trang chi tiết dùng `state.from` để giữ nguyên query.
- **Nút bấm dùng `components/UiButton.tsx`**, chỉ 6 dạng `primary`, `primary-lg`, `default`,
  `danger`, `icon`, `fab`; prop tên là `kind` vì AntD đã dùng `variant` cho kiểu nút. Không tự
  viết class nút mới. **Đừng ghi đè kích thước bằng class.** Hai class `!h-*` có cùng độ ưu
  tiên nên Tailwind quyết định theo thứ tự sinh CSS, không phải thứ tự truyền vào, nên
  truyền `className="!h-9"` lên nút có preset `!h-10` sẽ **không** có tác dụng. Muốn nhỏ lại
  thì truyền `size="small"`; bảng `HEIGHTS` trong UiButton đã tính sẵn.
- **Chiều cao nút phải ghi bằng tiền tố `!`** (`!h-11`): AntD nạp CSS-in-JS sau Tailwind và
  sẽ ghi đè chiều cao, nút chatbot từng bị vì thế mà chỉ còn 40px.
- **Thanh điều hướng một hàng ở mọi kích thước**: logo (`BrandMark`, bấm về `/`), ô tìm kiếm
  co giãn, nút đơn hàng, nút giỏ, avatar/nút đăng nhập. Từ `lg` chuông và đơn hàng có nút riêng
  trên header (chuông mang chấm đỏ chưa đọc); dưới `lg` hai mục này nằm trong menu tài khoản
  và mở drawer tương ứng. Nút đơn hàng (icon `inbox`) chỉ hiện từ `lg` khi đã đăng nhập vì
  `/orders` cần token; đừng thêm menu điều hướng, các trang con còn lại nằm trong menu tài khoản.
  Trang đăng nhập/đăng ký (`AuthShell`) không hiển thị thương hiệu/link về bảng món.
- **Chiều cao header là `--header-h` (`3.25rem`)** trong `index.css`; khối chatbot dùng
  `top-[var(--header-h)]`, vùng cuộn của `FoodsPage` dùng `calc(100dvh-var(--header-h))`. Đổi
  chiều cao chỉ sửa biến, đừng hard-code lại ở ba nơi. Trang chi tiết và checkout cũng dùng
  `top-[calc(var(--header-h)+1rem)]` cho cột sticky.
- **Chatbot mở bằng `store/uiStore.ts`** (`chatOpen`), không còn state cục bộ, để hero và empty
  state mở được; nút làm mới hội thoại xoá ngữ cảnh cũ và cấp `sessionId` mới. Dải gợi ý luôn
  nằm trên ô nhập, cuộn ngang trên mobile, thay vì biến mất sau tin đầu.
- **Chatbot chỉ giữ thẻ của tin bot mới nhất** (tối đa 5); tin bot cũ vẫn còn chữ nhưng mất
  `foods`, nên khung chat không dồn thẻ. Không còn nút "Xem thực đơn" trong khung chat. Nút
  thêm món trong thẻ yêu cầu đăng nhập: khách vãng lai thấy nút disabled kèm tooltip và bấm
  không điều hướng theo link của thẻ.
- **Cụm chatbot bám trang** bằng `fixed inset-x-0 bottom-0 top-[var(--header-h)]` + `justify-end`,
  khung chat
  `flex-1` nên tự co theo màn hình. Không hard-code chiều cao khung chat bằng `100dvh - Xrem`,
  cách đó dễ trượt khi header đổi kích thước. Vùng trống của cụm có `pointer-events-none` nên
  không chặn bấm vào thẻ món.
- **Ảnh local phải là `.webp`**: `client/public/images` chỉ chứa webp, không có `.jpg`.
  Đường dẫn ảnh nằm trong DB (`food.image_url`, `category.image_url`) nên đổi định dạng phải
  sửa `DataSeeder` **và** chạy `UPDATE ... WHERE right(image_url,4) = '.jpg'`; seeder bị bỏ qua
  khi DB đã có dữ liệu. Cỡ ảnh theo ô hiển thị: `foods` 1200px, `categories` 800px,
  `hero` 1280px (hero vốn đã blur + opacity nên quality thấp vẫn đẹp).

## Commands

Chạy trong `client/` hoặc `server/` (không có script ở root).

**Client** (`./client`):
- Dev server: `npm run dev` (http://localhost:5173)
- Build: `npm run build` (tsc --noEmit + vite build → `dist/`)
- Typecheck: `npm run typecheck` (tsc --noEmit). Không có lint target, client chưa có test runner; kiểm tra bằng typecheck + build.
- API client dùng `VITE_API_URL` làm `baseURL`; `vite.config.ts` không có proxy `/api`.

**Server** (`./server`):
- Dev: `docker compose --profile dev up --build` từ repo root (postgres + server-dev +
  client-dev, hot reload), hoặc `mvn spring-boot:run` (cần Postgres ở localhost:5432
  và nạp các biến từ `.env` - Maven không tự đọc `.env`)
- Build/test: `mvn package` / `mvn test`. Có 3 test class (`PricingServiceTest`,
  `ChatbotServiceTest`, `OrderDtosValidationTest`), chạy độc lập không cần DB.
- Prod: `docker compose --profile prod up --build -d`

**Full stack** (repo root):
- Prod: `docker compose --profile prod up --build`
- Dev: `docker compose --profile dev up --build`
- `docker compose up` (không profile) chỉ khởi động Postgres.
- Compose tự dựng `DB_URL` từ `DB_NAME`; `AI_PROVIDER` mặc định `gemini`, `UPLOAD_DIR=/app/uploads`.
  Các biến còn lại đọc từ `.env`, tên khớp `application.yml` (`DB_USER`/`DB_PASSWORD`, `JWT_SECRET`,
  `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`).

## Quy ước comment và tài liệu

- Comment mới dùng tiếng Việt, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
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
  `condition: service_healthy`, mà server cần ~28s (mvn compile + Spring Boot). Trước đó client
  gọi vào cổng 8080 đã publish nhưng chưa có backend nên ra `net::ERR_EMPTY_RESPONSE`. Đừng bỏ
  healthcheck để "nhanh hơn".
- UI tiếng Việt (`lang: vi`). Giữ chuỗi giao diện và thông báo lỗi bằng tiếng Việt.
- **Quyền ADMIN kiểm soát ở server** bằng HTTP (`hasRole("ADMIN")` trên `/api/admin/**`),
  không chỉ dựa vào ẩn menu client. Route guard client chỉ là UX.
- **Hot reload server**: `spring-boot-devtools` restart khi file `.class` đổi. Trong
  container chỉ mount mã nguồn nên cần biên dịch: chạy `docker compose --profile dev exec
  server-dev sh -c "while true; do mvn -q compile; sleep 3; done"` ở một terminal khác
  (hoặc để IDE biên dịch vào `server/target/classes`).
- **Lưu ý phiên đăng nhập:** `authStore` hỗ trợ `localStorage` và `sessionStorage`;
  `client/src/api/http.ts` đọc token từ `localStorage` rồi fallback `sessionStorage`, nên ô
  "Ghi nhớ đăng nhập" hoạt động đúng cả hai chế độ.
- **Hai layout riêng**: route khách nằm trong `DefaultLayout`, route `/admin/*` nằm trong
  `AdminLayout` (menu trái 5 mục, không có khung chatbot). Thêm route admin mới thì nhớ khai
  báo trong `AdminLayout`, đừng gắn vào `DefaultLayout`.
- **`useHasBottomBar` tính theo đường dẫn**: `/checkout` có thanh đặt món,
  `/foods/*` có thanh thêm món trên mobile. Trang mới có thanh cố định đáy
  thì phải cập nhật hook, nếu không nút mở chatbot sẽ bị thanh che. Hai drawer giỏ/thông báo
  dùng `activeDrawer` trong `uiStore` để không chồng mask.
- `JwtFilter` nuốt exception không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- **Seed bị bỏ qua nếu DB đã có user.** Đổi dữ liệu mẫu (ví dụ mật khẩu demo) thì database cũ
  vẫn giữ giá trị cũ; reset bằng `docker compose --profile prod down -v` rồi `up` lại.
- **`AI_API_KEY` trong `.env` phải là khóa thật.** Để trống, sai hoặc hết hạn thì trợ lý bị khóa
  hẳn ngay khi mở trang: `/api/chatbot/status` trả `available = false`, khung chat hiện banner và
  khóa ô nhập. Đó là hành vi dự kiến chứ không phải lỗi code. Muốn demo luồng có gợi ý món thì
  phải thay khoá thật rồi khởi động lại server (kết quả kiểm tra khóa cũ được giữ trong bộ nhớ).
- Không giữ bí mật trong code hoặc trong file commit - chỉ trong `.env`.