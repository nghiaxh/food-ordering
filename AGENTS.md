# AGENTS.md - FoodOrdering

Web đặt món tích hợp Chatbot AI tư vấn món ăn (niên luận ngành). Monorepo
client-server, không có build tooling ở root; `client/` và `server/` build độc lập.

## Kiến trúc

- **client/** - Vue 3 (Composition API, `<script setup>`) + TypeScript, Vite, Naive UI,
  Tailwind CSS 4, Pinia, Axios, Vue Router. SPA thuần, không SSR. Cấu trúc `user/` và `admin/` theo
  module chức năng (`user/auth/`, `user/menu/`, `admin/menu/`...), mỗi module gồm `api.ts`, `store.ts`
  (nếu có store) và `components/`, `pages/`; hạ tầng dùng chung ở `shared/` (`api/http.ts`,
  `types/`, `utils/`, `stores/`). Toast/message dùng naive-ui (`createDiscreteApi`). UI tiếng Việt.
- **server/** - Express 5 + TypeScript, Drizzle ORM (node-postgres), PostgreSQL 18.
  JWT bằng `jsonwebtoken` (HS256) + `bcrypt`; validate đầu vào bằng `zod`. Cấu trúc `src/user/` và `src/admin/`
  theo module chức năng giống client, lớp chính `src/server.ts`; middleware tập trung ở
  `src/middleware/` (auth, error), tiện ích ở `src/lib/`.
- **AI** - `server/src/lib/provider.ts` là lớp DUY NHẤT gọi API AI (`generate` với `jsonMode` ép
  JSON, timeout 15s mặc định) và DUY NHẤT sinh vector embedding (`embed`, `embedBatch`). Chỉ hỗ trợ
  Gemini (`@google/genai`); khoá đọc từ `AI_API_KEYS`, model chat từ `AI_MODELS`, model embedding từ
  `EMBEDDING_MODELS`; cả ba nhận một giá trị hoặc danh sách phân tách dấu phẩy/xuống dòng. Tự xoay
  khoá khi một khoá bị 429 và loại khoá bị từ chối (401/403 hoặc `API_KEY_INVALID`) tới khi khởi
  động lại server. Danh sách model mặc định `gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash`;
  gặp 503/404/timeout thì xoay model kế tiếp, model 404 bị loại tới khi restart, model 503/timeout
  nghỉ 60s. Vector 768 chiều (`EMBEDDING_DIM`). Muốn thêm nhà cung cấp khác chỉ sửa file này. Khoá
  không bao giờ gửi xuống client.
  Trang Chatbot của admin chỉ lưu `max_suggestions` và `extra_rules`; model/embedding đọc từ biến
  môi trường, không hardcode `gemini`.
- **Chịu tải provider**: `provider.ts` retry tối đa 2 lần cho 5xx (delay 600ms rồi 1800ms), khoá
  25s sau một 429 thật và xoay khoá khác (`AiRateLimitedException`), model 503/timeout nghỉ 60s
  rồi xoay model kế tiếp, deadline tổng 45s. Timeout riêng theo bước (`AI_TIMEOUTS.reply` 20s,
  `embed` 8s); `thinkingBudget: 0` gửi cho mọi model chat, model nào trả 400 thì bỏ cờ và ghi nhớ
  theo model. Prompt trả lời chỉ gửi tên/giá/loại của tối đa 10 món.
- **Infra** - `docker-compose.yml` 1 file, 3 profile: `prod` (db + server-prod +
  client-prod), `dev` (db + server-dev + client-dev với volume mount, hot reload) và `tools`
  (Drizzle Studio). Service `database` không khai báo `profiles` nên Postgres luôn chạy theo mọi
  profile, kể cả `docker compose up` không profile. Image Postgres: `pgvector/pgvector:0.8.7-pg18`
  (hỗ trợ pgvector extension).
  Server dev reload nhờ `tsx watch` (không cần bước compile riêng).
  Một file `.env` duy nhất ở root chứa mọi bí mật; compose tự dựng `DATABASE_URL`.

### Chatbot - cấu trúc file mới

```
server/src/user/chatbot/
  routes.ts          - endpoint /chat (requireAuth), /status, /sessions (rate limit)
  parse.ts           - intent (hasFoodSignal, looksLikeGibberish, wantsMoreDishes, refersToLastPicks, isReferenceKeyword), readConstraints
  constraints.ts     - readConstraints (regex), matchDishes, kiểu Constraints
  select.ts          - filterMenu (SQL), buildCards, quickRepliesFor
  reply.ts           - composeFoodReply (AI), composeInfoReply (RAG)
  prompts.ts         - CHAT_PROMPT (mẫu prompt AI viết câu trả lời)
  service.ts         - điều phối: intent -> filterMenu -> composeFoodReply -> thẻ món
  grounding.ts       - hasForeignScript, dropTrailingQuestion, limitSentences
  retrieval.ts       - pgvector retrieval
  ingest.ts          - upload, chunk, embed
  documentParser.ts  - parse + chunk v2
  sessions.ts        - lịch sử hội thoại
```

### Chatbot - một lượt gọi AI, bốn bước chống AI bịa món/giá

```
Người dùng → Chatbot → (1) Server đọc tiêu chí bằng regex
           → (2) Server lọc món bằng SQL Drizzle
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT (jsonMode)
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

AI **không bao giờ** được tự nghĩ ra món/giá. Prompt trả lời chỉ nhận danh sách món server đã lọc từ
`foods`; criteria regex không bao giờ được coi là rỗng (tiêu chí rỗng khớp mọi món, khách hỏi món chay
lại nhận cà phê đá). AI lỗi (429/5xx, timeout, JSON hỏng) thì `chat()` ném `502`. Chỉ khách **đã đăng
nhập** mới ghi lịch sử hội thoại (`requireAuth` routes.ts); khách vãng lai chat được nhờ
`history`/`lastFoodIds` đọc ở `loadContext` trong `service.ts`, không lưu vào DB.

**Cổng ý định**: `normalizeChat` đổi teencode phủ định ("ko/k/hok/hem" -> "không", "100 k" -> "100k")
trước khi đọc regex. Câu không có tín hiệu món ăn (`hasFoodSignal`) **và** không có ràng buộc nào
(ngân sách, số người, độ cay, chế độ ăn, tên món, dị ứng loại trừ, yêu cầu độ cay), hoặc gõ lung
tung (`looksLikeGibberish`, cụm phụ âm >= 5) trả câu từ chối cố định, `intent = OUT_OF_SCOPE`, không
gọi AI và không trả thẻ món.

**Cách áp tiêu chí** (`chatbot/constraints.ts` + `chatbot/select.ts`):
Regex đọc ràng buộc từ câu (budget, people, spicy, diet, exclude, dishes); criteria rỗng khớp mọi món.
Việc lọc món chạy hoàn toàn bằng SQL Drizzle trong `filterMenu`:
1. Chỉ món `available`; `lastFoodIds` dùng để loại ("món khác" -> `NOT IN`) hoặc giới hạn ("món đó" -> `IN`).
2. Lọc `spicyMax`, `spicyRequired`, nhãn chế độ ăn, thành phần loại trừ; `spicyMax = 0` chặn thêm
   tên/nguyên liệu chứa "ớt" vì dữ liệu `spicyLevel` có thể sai.
3. Ngân sách là **TỔNG** của cả nhóm nên mỗi món bị chặn ở `floor(budget / people)`.
Kết quả lấy tối đa 10 dòng, thẻ trả về tối đa **5** (`ai_setting.max_suggestions`, kẹp 1..5). Số phần
cắt ở `buildCards` ở server (theo `max_suggestions`), không giao cho AI tự tính.

**Khi AI lỗi**: `chat()` ném `502` kèm câu xin thử lại, **không** render template. Câu trả lời dùng
template an toàn khi AI trả ngôn ngữ lệch (`hasForeignScript`). Câu trả lời được dọn ở server:
`dropTrailingQuestion` bỏ câu hỏi cuối, `limitSentences` cắt còn 3 câu. Thẻ món luôn lấy ID/giá từ DB
nên không có chuyện AI bịa món.

**RAG tài liệu quán** (chỉ khi provider dùng được): pgvector + embedding.
- Upload, parse, chunk không gọi AI, luôn chạy. Chunk v2: tách theo đoạn, giữ tiêu đề, overlap 80 ký tự, không cắt giữa từ.
- Embed chunk chỉ khi `isConfigured()` = true; thiếu khóa/provider lỗi thì chunk vẫn lưu, thiếu vector.
- Retrieval: `searchChunks` nhúng câu hỏi, cosine top 5, ngưỡng 0.55, chỉ tài liệu `enabled`; thiếu vector -> rỗng.
- Trả lời: `service.ts` ghép bullet trích chunk (cắt 400 ký tự) kèm `citations`, không gọi AI lượt 2; rỗng -> "Mình chưa có thông tin xác thực...".
- Bỏ hoàn toàn tsvector và `keywordSearchKnowledge`. Không còn fallback keyword.
- Model embedding: 768 chiều, chọn theo `EMBEDDING_MODELS` (danh sách, mặc định `gemini-embedding-2`).
- Image Postgres: `pgvector/pgvector:0.8.7-pg18`. Extension `vector`, cột `vector(768)`, HNSW index `vector_cosine_ops`.
**Câu hỏi tiếp**: `history` (3 câu gần nhất) và `lastFoodIds` (món ở tin bot gần nhất) đọc ở server
(`loadContext`, không cần client gửi kèm). `wantsMoreDishes` ("món khác", "gợi ý thêm") loại đúng các
món đó bằng `NOT IN`; `refersToLastPicks` ("món đó", "mấy món trên") chỉ xét trong `lastFoodIds` bằng
`IN`. Từ khoá là đại từ bị `isReferenceKeyword` loại trước khi lọc ILIKE, không thì danh sách ra rỗng.
Không dùng độ dài câu để đoán hỏi tiếp.

**Lịch sử hội thoại**: chỉ khách đã đăng nhập mới có lịch sử (`GET`/`DELETE /api/chatbot/sessions/**`,
`requireAuth`; `listSessions`/`getSession`/`deleteSession` trong `user/chatbot/service.ts`). Tin BOT
lưu kèm `chat_messages.payload` (jsonb) gồm `foods`/`intent`/`citations`/`quickReplies`, nên mở lại
phiên vẫn còn thẻ món; giá trong thẻ là giá lúc trả lời, còn thêm vào giỏ/đặt đơn vẫn lấy giá hiện
tại từ DB. Danh sách trả tối đa 20 phiên mới nhất, tiêu đề lấy từ câu hỏi USER đầu tiên
(`sessions.ts` `sessionTitle`, cắt 60 ký tự). Phiên của người khác trả 404 như phiên không tồn tại.
Client (`useChatConversation.ts`) chỉ nạp phiên mới nhất khi máy chưa có cache, giữ hội thoại đang
dở nếu đã có. Cache nằm ở `localStorage['chatbot.state']` dạng `{ ownerId, sessionId, messages }`;
`ownerId` là id tài khoản, `null` là khách vãng lai. Khi nạp, cache khác chủ bị bỏ chứ không hiển thị,
nên mở lại máy, hết phiên hay đổi tài khoản đều không lộ hội thoại người trước. `syncChatOwner`
gọi từ `App.vue` (widget chỉ mount ở layout khách, trang đăng nhập/đăng ký thì không) để dọn cache
khi đổi tài khoản; mỗi lần đổi chủ hoặc làm mới hội thoại tăng `requestEpoch` để phản hồi đang bay
của chủ cũ bị bỏ, không rơi vào hội thoại mới. Tin khách gửi trước khi đăng nhập không được tải lên server.

**Thiếu hoặc hỏng khoá AI**: `lib/provider.ts` `isConfigured()` false khi không có khoá nào còn sống,
tức `AI_API_KEYS` rỗng **hoặc** mọi khoá đều bị từ chối (401/403, hay 400 kèm
`API_KEY_INVALID`); cờ "bị từ chối" giữ tới khi khởi động lại server. Hết khoá khả dụng tạm thời
(429) thì tất cả khoá còn sống đều đang cooldown. `GET /api/chatbot/status` gọi `verifyKey()` và probe
song song các model; `available = false` chỉ khi **mọi** model đều báo lỗi rõ ràng (503/404), còn một
model chậm (timeout) hay chết riêng lẻ vẫn tính là dùng được. Kết quả false giữ 60s, true giữ 5 phút.
Khi không dùng được:
- `chat()` ném `503 SERVICE_UNAVAILABLE` trước khi lưu câu hỏi hay chọn món.
- status trả `available = false` để client khoá ô nhập, hiện banner.
- RAG trả "Mình chưa có thông tin xác thực về mục này trong tài liệu của quán."
- Embedding không chạy, chunk vẫn lưu nhưng thiếu vector.
- Nhánh không gọi AI (chào, cảm ơn, hướng dẫn đặt món, câu ngoài phạm vi) vẫn chạy bình thường.

### Key wiring (không rõ từ tên file)

- **Không dùng Flyway.** Schema do Drizzle ORM (`drizzle-kit`) quản lý (`server/drizzle/`);
  seed nạp qua `server/src/db/seed.ts`, bỏ qua nếu bảng `users` đã có dữ liệu,
  nên không nhân đôi dữ liệu demo khi chạy lại.
- **Security**: middleware stateless `requireAuth`/`optionalAuth`/`requireRole` ở
  `src/middleware/auth.ts`, không session. Public: `/api/auth/register`,
  `/api/auth/login`, GET `/api/foods/**` `/api/categories/**` `/api/reviews/**`
  `/api/uploads/**`, `/api/chatbot/status` và `/api/chatbot/chat` (khách vãng lai vẫn chat được);
  `/api/chatbot/sessions/**` yêu cầu đăng nhập;
  `/api/admin/**` yêu cầu role `ADMIN`; `/api/cart/**`, `/api/orders`, `/api/orders/**` yêu cầu
  role `CUSTOMER`; phần còn lại cần đăng nhập. Mọi lỗi đi qua `middleware/error.ts` và trả
  `{ message }` tiếng Việt với đúng mã 4xx/5xx, không lộ chi tiết nội bộ.
  Token sinh bằng `src/lib/jwt.ts`, middleware tra CSDL mỗi request để tài khoản bị
  khoá mất quyền ngay. CORS mở cho demo.
- **Giá luôn lấy từ DB**: `user/order` `createOrder` set `price` = giá trong DB, không tin client.
- **Giỏ bắt buộc đăng nhập**: khách vãng lai không có giỏ local; ở thẻ chatbot nút thêm món bị
  khoá kèm tooltip "Đăng nhập để thêm món vào giỏ" (NTooltip trong thẻ chatbot), ở thẻ món
  trang thực đơn thì bấm nút dấu cộng sẽ được đưa sang `/login`; `/checkout` nằm trong
  requireAuth còn `/cart` chỉ chuyển hướng về `/checkout`. Giỏ mở bằng drawer toàn cục
  (`user/cart/components/CartDrawer.vue`), khách bấm giỏ khi chưa đăng nhập được đưa sang `/login` kèm cờ
  `openCart` để mở lại sau khi đăng nhập. `cartStore.add` trả `Promise<boolean>` và từ chối khi
  chưa đăng nhập. Store thay dòng optimistic
  bằng `CartItem` server trả để món thêm từ chatbot có đủ field và giá đúng; response chỉ được áp
  theo số thứ tự request của từng món. `CartItem.quantity` mặc định `1`, nên `cart` module tạo
  dòng mới với `quantity = 0` trước khi cộng, không thì lần thêm đầu tiên dư 1 phần.
- **Tiền chỉ tính ở `user/pricing` (server)**: `POST /api/cart/quote` nhận `{ items }` đúng danh sách dòng
  client đang hiển thị và tính bằng `priceOrder`; lúc tạo đơn dùng chung module này. Quote **không
  đọc lại giỏ DB** để response cũ không ghi đè giỏ mới. Client không nhân phần trăm hay trừ khuyến
  mãi, chỉ hiện lại `QuoteLine.lineDiscount` (số tiền giảm của **cả dòng**). Mỗi dòng chỉ nhận một
  khuyến mãi tự động tốt nhất. `composables/useCartQuote.ts` là nơi duy nhất gọi quote, dùng chung cho
  drawer giỏ và `/checkout`.
- **Báo cáo quản trị theo ngày lịch Việt**: `from`/`to` của `/api/admin/reports/**` đọc bằng
  `parseBusinessRange` (`server/src/lib/businessTime.ts`): chuỗi `"YYYY-MM-DD"` là ngày lịch VN
  (đầu/cuối ngày theo giờ Việt), chuỗi ISO datetime giữ nguyên instant, ngày sai hoặc
  `from > to` trả 400. Client `AdminReportsPage` gửi chuỗi `"YYYY-MM-DD"` theo ngày đã chọn (không
  phải ISO UTC) và hiển thị ngày trong bảng bằng `dayLabel` để không lệch ngày theo múi giờ máy.
  `topFoods` gom theo `foodId` nên hai món trùng tên vẫn là hai món khác nhau.
- **Khuyến mãi admin**: phạm vi `CATEGORY`/`FOOD` **phải** có `targetIds` (danh sách rỗng thì KM không
  khớp món nào, server trả 400 và client chặn trước khi gửi); `usageLimit` bằng `0` nghĩa là **không
  giới hạn** (lưu `null`); `minOrderTotal` là hạn mức tổng đơn tối thiểu, engine `user/pricing` chỉ
  áp KM khi tổng đơn đạt mức (`minOrderReached`) nên trên thực đơn (chưa có tổng đơn) các KM có hạn
  mức không hiện giảm.
- **Sửa đơn ở quản trị**: món chỉ sửa được khi đơn `PENDING` **và** `UNPAID` (`order` module `canEditItems`);
  đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn kể cả thông tin giao hàng (kiểm trong `adminUpdateOrder`);
  các
  trạng thái còn lại chỉ sửa được người nhận/SĐT/địa chỉ/ghi chú/trạng thái. `adminOrderSchema.items`
  được phép null, còn `adminCreate` tự kiểm danh sách món không rỗng. Khách cũng chỉ hủy được đơn
  `PENDING` + chưa thanh toán; client ẩn nút bằng `canCancelOrder` trong `client/src/shared/utils/orders.ts`.
- **Đơn admin tạo/sửa/xoá**: đơn tạo mới luôn bắt đầu `PENDING`, chỉ tạo được trạng thái đi tiếp được
  từ `PENDING` (`PENDING`/`CONFIRMED`/`CANCELLED`, xem `isCreatableStatus`), `CONFIRMED` + `QR` phải đã
  thu tiền. `adminUpdateOrder` áp `paid` **trước** khi đổi trạng thái để guard QR thấy trạng thái
  thanh toán mới; `items: []` nghĩa là **không đổi món** (chỉ sửa thông tin giao hàng). Đổi món thì
  `order_items` không lưu id khuyến mãi nên phải tính lại giá món cũ để trả lại `usedCount` của KM cũ
  rồi mới `markUsed` KM mới (`syncPromotionUsage`). Xoá đơn xoá trong một transaction gồm thông báo,
  giao dịch thanh toán, dòng món và đơn để không còn dữ liệu móc.

- **Nhãn PREPARING là "Đang vận chuyển"**: mã trạng thái trong DB không đổi, chỉ đổi nhãn hiển thị
  (`ORDER_STATUS_LABEL`, `order` module, thông báo "đang được vận chuyển"); nút admin
  `CONFIRMED → PREPARING` là "Giao hàng", nút **Đặt lại** ở `/orders` chỉ hiện khi `COMPLETED`.
- **Đơn QR quá hạn thanh toán tự hủy**: chỉ đơn `PENDING` + `UNPAID` + `QR` tạo quá
  `ORDER_PAYMENT_TIMEOUT_MINUTES` (mặc định 30) mới bị hủy; COD trả khi giao nên không tính giờ.
  `user/order/expiryJob.ts` quét ngay khi khởi động rồi mỗi 60s bằng một câu `UPDATE ... WHERE`
  có điều kiện (đơn vừa thanh toán xong thì không khớp), thông báo tạo cùng transaction. Hủy tự động
  không hoàn `usedCount` của khuyến mãi, giống luồng khách tự hủy. `updatePayment` chặn ghi `PAID`
  cho đơn đã `CANCELLED` để không lọt trạng thái hủy mà vẫn thu tiền. `toOrderJson` trả thêm
  `paymentDeadlineAt` (null với COD, đơn đã trả tiền hoặc đã chốt); `OrdersPage` đếm ngược hạn này,
  khoá nút thanh toán khi hết hạn và tự tải lại danh sách sau khi server kịp quét.
- **Ràng buộc biên**: mật khẩu ≥ 8 ký tự, SĐT `^0\d{9}$` (cả đơn khách lẫn đơn admin tạo/sửa),
  giỏ không nhận món ngừng phục vụ, trạng thái đơn đi đúng một chiều, không sửa/khoá/xoá tài khoản
  quản trị. Chi tiết kiểm thử xem README và CI.
- **Types client phải đồng bộ với DTO server** (thủ công). Sửa DTO nhớ cập nhật
  `client/src/shared/types/index.ts` và file `api.ts` của module tương ứng.
- **Lọc món bằng SQL**: `chatbot/service.ts` `filterMenu` dựng điều kiện Drizzle (`available`,
  `inArray`/`notInArray` cho `lastFoodIds`, `spicyLevel`, ILIKE NOT cho thành phần dị ứng, giá
  `<= floor(budget / people)`), sắp theo giá tăng dần và ưu tiên món chính. Không còn
  `filter.ts`/`scoring.ts`/`plan.ts`: không chấm điểm, không chọn bộ.
- **RAG chỉ dùng pgvector**: bỏ tsvector và `keywordSearchKnowledge`. Provider không dùng được -> RAG
  trả "Mình chưa có thông tin". Upload + chunk không gọi AI, luôn chạy. Embed chỉ khi `isConfigured()`.
- **AI chỉ hoạt động khi `isConfigured()`**: cần ít nhất một khoá Gemini còn sống trong `AI_API_KEYS`.
  Thiếu cấu hình thì `chat()` trả 503, không có code mode gợi ý món.
- **Hai danh sách model riêng**: chat theo `AI_MODELS`; embedding theo `EMBEDDING_MODELS`; mỗi biến
  nhận một giá trị hoặc danh sách, trống thì dùng danh sách mặc định. Cùng provider nên dùng chung khoá.
- **Pipeline**: `intent` -> `filterMenu` (SQL) -> `composeFoodReply` (AI call). Thẻ món lấy ID/giá từ DB.
- **Ảnh món** trong seed dùng file local dưới `client/public/images/foods/`; admin tải ảnh
  lên qua `POST /api/admin/uploads/image` (JPG/PNG/WEBP, ≤ 2 MB, kiểm bằng chữ ký đầu file
  chứ không tin Content-Type) hoặc dán URL ngoài trong form. File lưu ở `UPLOAD_DIR`
  (volume `uploads`) và phục vụ tại `/api/uploads/**`; endpoint trả URL **tuyệt đối** nên
  không cần sửa nginx.
- **Giao diện kiểu kiosk**: thực đơn là trang chủ `/`, có hero ngắn, dải danh mục dạng chip chữ
  và "Ưu đãi hôm nay" trước lưới món. Chi tiết món là **trang riêng** `/foods/:id` trong
  `DefaultLayout` (không còn Drawer hay route con). Bộ lọc của trang chủ nằm trên URL (`category`,
  `keyword`, `min`, `max`, `people`, `sort`, `diet`, `spicy`, `available`, `deal`, `page`), đọc bằng
  `useRoute().query`. `people` lọc món có `servingSize >= people`, gửi lên server qua `GET /api/foods`
  và điều khiển bằng dropdown "Khẩu phần" với các lựa chọn `Mọi khẩu phần`, `1 người`, `2 người`,
  `3 người`, `4 người`, `Trên 5 người` (gửi `people=6`). Khối danh mục + lọc
  dùng chung một vùng `sticky top-0` ngay dưới header: desktop gom một hàng, tablet/mobile xếp 3
  hàng (danh mục, khoảng giá, số người). Lưới món giữ 2 cột dưới `md`, 4 cột từ `md`, mỗi trang 12
  món và phân trang số trang. Vị trí cuộn lưới lưu ở `sessionStorage['menu-scroll']`, nút quay lại
  của trang chi tiết dùng `state.from` để giữ nguyên query.
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
- **Mở rộng khung chat bằng `uiStore.chatExpanded`** (`toggleChatExpanded`): panel vẫn nằm trong
  cụm `fixed` dưới header nhưng bỏ padding, bỏ bo góc/viền và ẩn nút launcher; nội dung bên
  trong giới hạn `max-w-3xl` để dòng chữ không kéo hết chiều ngang. Nút mở rộng chỉ hiện từ
  `sm` vì mobile vốn đã full màn hình. `Esc` thu nhỏ trước, `Esc` lần nữa mới đóng; `closeChat()`
  reset `chatExpanded` để lần mở sau trở về kích thước nhỏ.
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
- **Trạng thái tiến trình thay cho gõ chữ**: server trả một JSON (không streaming); trong lúc chờ,
  `useChatConversation.ts` vòng qua các trạng thái "Đang phân tích..." → "Đang tra cứu..." →
  "Đang soạn câu trả lời..." (khoảng 3s/bước). Câu trả lời AI tối đa 2 câu (`CHAT_PROMPT`,
  `limitSentences` 3 câu). Câu trả lời hiện nguyên khối khi có kết quả. Khung chỉ tự cuộn khi
  người đọc đang ở đáy (cách đáy ≤ 64px), cuộn lên thì hiện nút "Tin mới nhất". Thẻ món và quick replies
  hiện cùng lúc với câu trả lời. Vùng tin nhắn là `role="log"` với `aria-live` tắt trong lúc chờ để
  trình đọc màn hình không đọc lại từng khung.
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
- Compose tự dựng `DATABASE_URL` từ `DB_NAME`; `UPLOAD_DIR=/app/uploads`.
  Các biến còn lại đọc từ `.env`, tên khớp cấu hình server (`DB_USER`/`DB_PASSWORD`, `JWT_SECRET`,
  `JWT_EXPIRATION_MS`, `AI_API_KEYS`, `AI_MODELS`, `EMBEDDING_MODELS`, `ORDER_PAYMENT_TIMEOUT_MINUTES`).

## Quy ước comment và tài liệu

- Comment mới dùng **tiếng Việt không dấu**, ngắn gọn và giải thích **vì sao**, ràng buộc nghiệp vụ,
  nguồn dữ liệu, vòng đời state hoặc cách fallback; không lặp lại cú pháp hoặc từng dòng JSX.
- Dùng `//` cho quyết định cục bộ, Javadoc/JSDoc cho hợp đồng hoặc ranh giới quan trọng.
- Quy ước này áp cho **mọi comment trong mã và file cấu hình** (`client/src`, `client/e2e`,
  `server/src`, `server/tests`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `*.css`).
  Chuỗi hiển thị cho người dùng, prompt AI và dữ liệu seed vẫn viết có dấu. Log ghi ra
  terminal (server) dùng tiếng Việt không dấu.
- Khi đổi endpoint, DTO, quy tắc domain hoặc luồng nghiệp vụ, cập nhật đồng bộ
  `AGENTS.md` và tài liệu liên quan. Khi đổi quy ước phân nhánh hoặc commit,
  cập nhật đồng bộ `AGENTS.md`.

## Phân nhánh và Git

- Không làm việc trực tiếp trên `main` (không commit, không push thẳng lên `main`).
- Luôn đồng bộ trước khi tách branch: `git checkout main` rồi `git pull origin main`.
- Mọi thay đổi tách từ `main` thành branch riêng: `feat/<ten>`, `fix/<ten>`,
  `docs/<ten>`, `refactor/<ten>`, `test/<ten>`. Không dùng `dev` hay `draft`.
- Mở PR ngược về `main`, merge bằng squash merge để lịch sử gọn. Chi tiết xem mục này.
- Commit theo Conventional Commits, dùng tiếng Anh: `<type>[optional scope]: <description>`,
  lowercase, imperative, no period. Một commit một mục đích, một commit một loại thay đổi.
- Không commit, push hay rewrite history trừ khi user yêu cầu rõ ràng.

## Gotchas

- **`.env` bắt buộc** và chứa mọi bí mật (DB, JWT, khoá AI). Copy từ `.env.example` →
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
  "Ghi nhớ đăng nhập" hoạt động đúng cả hai chế độ. Tích ô này thì email được lưu ở
  `localStorage['auth.remembered-email']` để trang đăng nhập tự điền và khách chỉ cần nhập mật
  khẩu (nút "Đổi tài khoản" xoá email đó); bỏ tích thì xoá email, còn `logout()` giữ lại. Không
  lưu mật khẩu, và "ghi nhớ" không kéo dài hạn token (`JWT_EXPIRATION_MS`).
- **Hai layout riêng**: route khách nằm trong `DefaultLayout`, route `/admin/*` nằm trong
  `AdminLayout` (menu trái 4 nhóm / 8 mục, không có khung chatbot). Thêm route admin mới thì nhớ khai
  báo trong `AdminLayout`, đừng gắn vào `DefaultLayout`.
- **`useHasBottomBar` tính theo đường dẫn**: chỉ `/checkout` có thanh đặt món, và chỉ khi giỏ
  còn món. Trang mới có thanh cố định đáy
  thì phải cập nhật hook, nếu không nút mở chatbot sẽ bị thanh che. Hai drawer giỏ/thông báo
  dùng `activeDrawer` trong `uiStore` để không chồng mask.
- **Store thông báo giữ danh sách khi tải lỗi**: `user/notification/store.ts` là nguồn chung cho
  header (số chưa đọc) và drawer (danh sách). `load()` lỗi mạng phải **giữ nguyên** danh sách cũ,
  không xoá sạch, để header không mất chấm chưa đọc và lần mở sau vẫn thử lại được.
- `requireAuth`/`optionalAuth` bọc lỗi không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- **`NDrawer` không render slot `#header`/`#header-extra`/`#footer`**: naive-ui chỉ hiện tiêu đề, nút
  đóng và footer khi nội dung nằm trong `NDrawerContent`. Slot đặt thẳng trên `NDrawer` bị bỏ qua
  âm thầm (tiêu đề drawer, nút "Đã đọc", nút "Đóng" biến mất khỏi DOM).
- **Khu quản trị dùng palette orange riêng**: `client/src/shared/theme.ts` khai báo màu chủ đạo
  theo bảng màu native của Tailwind (orange-700/800/900) và `AdminLayout` bọc `NConfigProvider`
  riêng; trang khách giữ theme gốc khai trong `App.vue`. Vì vậy màu accent trong khu quản trị
  dùng class `orange-*`, không dùng `amber-*` (màu của khu khách) và không tự đặt hex.
- **Seed bị bỏ qua nếu DB đã có user.** Đổi dữ liệu mẫu (ví dụ mật khẩu demo) thì database cũ
  vẫn giữ giá trị cũ; reset bằng `docker compose --profile prod down -v` rồi `up` lại.
- **`AI_API_KEYS` trong `.env` phải là khoá thật** khi dùng Gemini. Để trống, sai hoặc hết hạn thì
  trợ lý bị khoá hẳn ngay khi mở trang: `/api/chatbot/status` trả `available = false`, khung chat hiện
  banner và khoá ô nhập. Đó là hành vi dự kiến chứ không phải lỗi code. Muốn demo luồng có gợi ý món
  thì phải thay khoá thật rồi khởi động lại server (kết quả kiểm tra khoá cũ được giữ trong bộ nhớ).
  Nhiều khoá Gemini thì đặt `AI_API_KEYS=key1,key2`.
- Không giữ bí mật trong code hoặc trong file commit - chỉ trong `.env`.
- **pgvector yêu cầu image `pgvector/pgvector:0.8.7-pg18`**. Volume cũ dùng lại được (cùng major 18). Chạy `CREATE EXTENSION IF NOT EXISTS vector;` trong migration trước khi thêm cột `vector(768)`.
- **Embedding chỉ chạy khi provider dùng được.** Cần ít nhất một khoá Gemini còn sống. Không dùng được thì chunk vẫn lưu nhưng thiếu vector. Admin bấm "Tạo embedding" khi provider sẵn sàng; `GET /api/admin/chatbot/documents/stats` trả `totalDocuments`, `totalChunks`, `embeddedChunks`, `ready`, `failed`.
- **Cả client và server dùng TypeScript 6.0.3.** `vue-tsc` 3.3.14 chỉ chạy với TypeScript < 7 vì bản 7
  là compiler native (Go), package `typescript` không còn API JS (`./lib/tsc`), còn `@volar/typescript`
  khai báo peer `typescript: "<7"`. Chỉ nâng lên 7.1 khi Vue Language Tools v4 (content mapper) ổn định;
  lúc đó bỏ `vue-tsc`, thêm `contentMappers` vào `tsconfig.json` và chạy `tsc --runExternalCode`.