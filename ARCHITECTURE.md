# Kiến trúc FoodOrdering

Mô tả ngắn gọn cách FoodOrdering vận hành và các quy ước quan trọng. Chi tiết ca kiểm thử xem [TEST.md](TEST.md).

## Tổng quan

Ứng dụng **đặt món trực tuyến** theo mô hình monorepo client–server. Điểm khác biệt: trợ lý AI
tư vấn món theo ngôn ngữ tự nhiên, gợi ý luôn nằm trong thực đơn thật và đặt được ngay.

```
┌──────────────────┐     VITE_API_URL (Bearer JWT)      ┌──────────────────────┐
│  Vite SPA client │ ─────────────────────────────────▶ │  Spring Boot server   │
│ (React + antd)   │ ◀───────────────────────────────── │  Java 25 + JPA        │
└──────────────────┘                                    └──────────┬───────────┘
                                                              PostgreSQL 18
```

- **client/**: React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + Zustand 5 + Axios + React Router 7. SPA thuần, không SSR. UI tiếng Việt. `client/src/api/http.ts` dùng `VITE_API_URL` làm `baseURL` (mặc định `http://localhost:8080/api`). Vite hiện không có proxy `/api`; nginx ở prod chỉ phục vụ static SPA và fallback route.
- **server/**: Spring Boot 3.5 (Java 25) + Spring Security (JWT access token đơn giản) + Spring Data JPA. Package gốc `com.foodordering`, layered `controller` → `service` → `repository`.
- **PostgreSQL**: `ddl-auto: update` đồng bộ schema khi khởi động (không dùng Flyway).

## Luồng dữ liệu chính

### 1. Xác thực (JWT access token)

1. Client gọi `POST /api/auth/login` hoặc `POST /api/auth/register` với email và mật khẩu.
2. Server trả về access token JWT kèm thông tin user và role (ADMIN / CUSTOMER).
3. `authStore` lưu phiên theo lựa chọn remember: `localStorage` hoặc `sessionStorage`.
4. `api/http` đọc token từ `localStorage`, chưa có thì lấy từ `sessionStorage`, rồi gắn
   `Authorization: Bearer <token>` cho request. Khi gặp 401 sẽ xoá token ở cả hai kho và đưa
   người dùng về trang đăng nhập.
5. `JwtFilter` trên server đọc và verify token, tra CSDL kiểm tra tài khoản còn `active`
   rồi mới dựng `SecurityContext`. Token không hợp lệ hoặc tài khoản đã bị khoá bị nuốt,
   request được coi là chưa đăng nhập. Cần tra CSDL mỗi request vì token vẫn còn hạn sau khi
   admin khoá tài khoản.
6. `SecurityConfig` stateless: yêu cầu `ROLE_ADMIN` cho `/api/admin/**`; phần còn lại dùng
   `authenticated()`, trừ các matcher được khai báo `permitAll()`.

Endpoint và chính sách public hiện tại:

- `permitAll()` áp dụng đúng cho `POST /api/auth/register` và `POST /api/auth/login`.
  `/api/auth/me` và `/api/auth/password` yêu cầu đăng nhập, gọi vô danh sẽ nhận 401.
- `GET /api/foods/**`, `/api/categories/**`, `GET /api/reviews/**`, `GET /api/uploads/**`
  (ảnh admin tải lên được phục vụ công khai vì mọi khách đều cần xem thực đơn).
- `POST /api/chatbot/chat`: tư vấn món, khách vãng lai vẫn dùng được.
- `dispatcherTypeMatchers(ERROR).permitAll()`: khi controller ném lỗi, Tomcat dispatch sang
  `/error`; nếu không cho phép riêng thì mọi lỗi 400/404/500 đều bị đổi thành 401 và mất
  thông báo gốc. Đây là lý do các lỗi validation trả về đúng mã 400.
- `POST /api/reviews` yêu cầu đăng nhập vì chỉ có matcher GET được permitAll.

Bảo vệ route trên client chỉ là UX - **quyền ADMIN được kiểm soát ở server**.

### 2. Duyệt và tìm món

- Trang danh mục gọi `GET /api/foods` và `GET /api/categories`.
- Lọc theo tên, loại, khoảng giá và trạng thái available qua query params.
- Chi tiết món gồm thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá.

### 3. Giỏ hàng (lưu theo tài khoản)

Giỏ hàng **lưu trên server** theo tài khoản (bảng `cart_items`, unique theo user + món):

- Chỉ khách đã đăng nhập mới có giỏ: thêm/sửa/xóa/clear món qua `/api/cart/**` (yêu cầu xác
  thực), giỏ được lưu trong database và còn nguyên khi đăng nhập lại từ thiết bị khác.
- Khách vãng lai **không có giỏ local**: nút "Thêm vào giỏ" bị khoá, hover hoặc focus hiện
  tooltip "Đăng nhập để thêm món vào giỏ". Giỏ mở thành **drawer bên phải** từ nút giỏ trên
  header hoặc thanh giỏ ghim đáy; khách chưa đăng nhập được đưa sang `/login` kèm cờ `openCart`
  và quay lại đúng trang, mở sẵn drawer. `/checkout` nằm trong `RequireAuth`, còn `/cart` chỉ
  chuyển hướng về `/checkout`. `cartStore.add` trả `false` khi chưa đăng nhập như lớp phòng thủ
  thứ hai.
- Đăng xuất thì `CartSync` gọi `resetLocal` để xoá state giỏ của tài khoản khỏi client.
- Giá món hiển thị từ dữ liệu trả về khi duyệt món.

### 4. Đặt món (giá lấy từ DB)

1. Client gửi `POST /api/orders` với danh sách món + số lượng, thông tin người nhận,
   phương thức thanh toán và **ghi chú cho quán** (`note`, tối đa 255 ký tự, tuỳ chọn).
2. `OrderService.create` set `price` = giá trong DB, **không tin giá từ client**; từ chối món ngừng phục vụ.
3. Mỗi đơn được ghi một giao dịch thanh toán (`payment_transactions`: phương thức, số tiền,
   trạng thái PENDING/PAID) và tạo thông báo xác nhận cho khách (`notifications`).
4. Trạng thái đơn dùng các giá trị `PENDING`, `CONFIRMED`, `PREPARING`, `COMPLETED`, `CANCELLED`
   — `PREPARING` có nghĩa là đang vận chuyển, nhãn hiển thị "Đang vận chuyển" ở cả client lẫn
   thông báo server (mã trong DB không đổi); trạng thái thanh toán dùng `UNPAID` hoặc `PAID`.
5. **Trạng thái đi đúng một chiều**: `PENDING → CONFIRMED → PREPARING → COMPLETED`, được canh
   trong `OrderService.isValidTransition`. Đơn đã `COMPLETED` hoặc `CANCELLED` không đổi trạng
   thái được. `CANCELLED` được phép từ mọi trạng thái chưa chốt. Client cũng lọc danh sách trạng
   thái hợp lệ bằng `allowedNextStatuses`, nhưng server mới là nơi quyết định.
6. Khách tự hủy được đơn của mình qua `PATCH /api/orders/{id}/cancel`, chỉ khi đơn còn `PENDING`
   **và** chưa thanh toán. Đơn đã `PAID` hoặc đã `CONFIRMED` thì quán đã bắt tay làm, hủy lúc đó
   là mất món, nên server trả 400 chứ không chỉ ẩn nút trên giao diện.
7. Thanh toán giả lập (COD / QR) - không tích hợp cổng thanh toán thật.
   Khách tự xác nhận đã trả qua `PATCH /api/orders/{id}/pay`; admin vẫn ghi nhận hoặc hoàn tác
   thủ công bằng `PATCH /api/admin/orders/{id}/payment?paid=...`. Mã QR trên `/orders` do component
   `QRCode` của antd sinh, mã hoá mã đơn (`FOOD-{id}-{tổng tiền}`) nên quét ra chỉ có thông tin
   nhận dạng đơn, không phải payload chuyển khoản; chỉ hiện với phương thức `QR`.
8. Admin có thể tạo, sửa và xoá đơn thay khách qua `/api/admin/orders` (UC12). **Sửa món chỉ
   khi đơn còn `PENDING` và chưa thu tiền**; sau đó chỉ còn người nhận, số điện thoại, địa chỉ,
   ghi chú và trạng thái. Đơn `COMPLETED` hoặc `CANCELLED` bị khoá hoàn toàn (`requireEditable`)
   để số liệu báo cáo và lịch sử của khách không bị sửa ngược. Giao diện khoá đúng như vậy:
   nút Sửa bị vô hiệu hoá ở hai trạng thái cuối, danh sách món trong form bị disable và kèm
   dòng giải thích khi đơn đã xác nhận hoặc đã thu tiền.
9. Ghi chú `note` chỉ ghi lúc tạo đơn, không sửa được về sau. Nơi đọc: dòng "Lưu ý cho quán"
   trên thẻ đơn ở `/orders` và khối "Lưu ý cho quán" trong drawer chi tiết đơn của admin.
   Nút "Đặt lại" chỉ hiện ở đơn `COMPLETED`, chỉ chuyển món sang giỏ, không mang theo ghi chú cũ.
10. Mã đơn hiển thị cho khách và quản trị viên là `FO-xxxx` (tiền tố `FO` + id đệm 4 chữ số),
    sinh bởi `orderCode` trong `client/src/utils/orders.ts` để hai bên không lệch nhau. Id do
    server cấp nên đổi tiền tố không cần sửa dữ liệu; mã QR vẫn giữ `FOOD-{id}-{tổng tiền}`.

### 4b. Ràng buộc dữ liệu ở biên

- Mật khẩu tối thiểu 8 ký tự (`@Size(min = 8)`), số điện thoại đúng 10 chữ số bắt đầu bằng 0
  (`@Pattern("^0\\d{9}$")`). Client và server cùng kiểm tra để báo lỗi ngay tại trường nhập.
- Phương thức thanh toán phải thuộc danh sách `COD|QR` (`@Pattern(regexp =
  PAYMENT_METHOD_PATTERN)` trong `OrderDtos`). `COD` là **tiền mặt khi nhận**, `QR` là **quét
  mã QR để chuyển khoản**; không có phương thức khác. Nhãn hiển thị nằm ở
  `client/src/utils/orders.ts` (`PAYMENT_METHOD_LABEL`) để trang khách và trang quản trị hiện
  giống nhau, không lộ mã thôi ra giao diện.
- Giỏ hàng chỉ nhận món đang phục vụ (`CartService.add`); lỗi hiện ở lúc thêm chứ không đợi tới
  lúc đặt.
- Món đã có trong đơn không xoá được (`FoodService.delete` trả 409 kèm gợi ý chuyển sang
  ngừng phục vụ), vì chi tiết đơn vẫn tham chiếu tới nó.
- Admin không khoá hay xoá được tài khoản quản trị (`AuthService.requireCustomer`).

### 4c. Khuyến mãi tự động

Mọi con số tiền của giỏ và của đơn do **một chỗ duy nhất** tính: `service/PricingService`.
Client không tự nhân phần trăm, không tự trừ voucher; nó gửi `POST /api/cart/quote` kèm
`{ items }` đúng danh sách dòng đang hiển thị và hiện lại đúng những gì server trả. Quote tính
bằng `priceOrder` trên danh sách đó, **không đọc lại giỏ trong DB**, nên thêm món xong không bị
response của giỏ cũ ghi đè. Nhờ vậy báo giá trong giỏ và tổng tiền của đơn đã tạo không thể
lệch nhau.

- **Đồng bộ báo giá ở client**: `useCartQuote(items)` dùng chung cho drawer giỏ và trang
  `/checkout`. Mỗi lần `items` đổi, hook abort request cũ, gọi lại `POST /api/cart/quote` và giữ
  số cũ trong lúc chờ để khối tổng tiền không nháy. Chỉ khi chưa có quote mới hiện "Đang cập nhật
  giá..." và khoá nút đặt món; dòng món tạm hiện giá gốc từ cart item.
- **Dòng optimistic**: `cartStore.add` và `setQuantity` thay dòng tạm bằng `CartItem` server trả
  (food đầy đủ field, giá là số, `available` đúng), nên món thêm từ chatbot không còn dòng
  "Hết món" giả. Mỗi món có số thứ tự request riêng; chỉ response của request mới nhất được ghi
  vào giỏ, nên response về muộn không đè lần bấm sau dù số lượng server trả khác dòng đang hiển
  thị. Xoá sạch giỏ hoặc đăng xuất thì tăng "thế hệ" giỏ để response đang bay không dựng lại dòng
  vừa xoá.
- **Số lượng dòng mới**: `CartService.add` tạo `CartItem` với `quantity = 0` trước khi cộng,
  vì entity mặc định 1; thiếu bước này thì lần thêm đầu tiên dư 1 phần so với số khách chọn.

- **Một dòng, một khoản giảm.** `QuoteLine.lineDiscount` và `OrderItem.discountAmount` là số
  tiền giảm của **cả dòng** (đã nhân số lượng), không phải của một phần.
- **Khuyến mãi tự động** (chương trình không có mã): mỗi dòng chọn **một** chương trình tốt
  nhất theo số tiền giảm, hoà thì xét `priority`. Không cộng dồn hai chương trình tự động trên
  cùng một dòng, nên hoá đơn đọc một lần là hiểu.
- **Phạm vi** `GLOBAL`, `CATEGORY`, `FOOD` quyết định chương trình có áp cho dòng đó
  không (`matches`). Chương trình theo danh mục chỉ khớp món.
- **Khuyến mãi theo dịp** dùng `daysOfWeek` (ví dụ `SAT,SUN`) và `startTime/endTime`; khung giờ
  qua nửa đêm được hiểu là `start > end`.
- **Món may mắn mỗi ngày** (`randomCount > 0`): mỗi ngày chọn `randomCount` món bằng hàm băm
  `hash(foodId, promotionId, ngày)` rồi sắp theo giá trị băm, nên cùng một ngày mọi người thấy
  cùng bộ món và sang ngày mới tự đổi, không cần scheduler.
- **Giá trên thẻ món**: `GET /api/foods` và `/api/foods` được `decorateFoods`
  điền `discountedPrice`, `discountAmount`, `discountPercent`, `discountLabel`; client chỉ hiện.
  Đây là giá tham khảo cùng luật với giỏ, còn con số chốt vẫn là báo giá.

### 5. Trợ lý AI tư vấn món (chống bịa món/giá)

Trợ lý AI dùng **hai lượt gọi AI, bốn bước xử lý** để AI không bao giờ tự nghĩ ra món hoặc giá:

```
Người dùng → (1) AI trích xuất tiêu chí (JSON)   [service/AiClient, jsonMode]
           → (2) Server truy vấn DB, lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client lấy ID/giá từ DB, không từ text AI
```

- Lượt AI đầu tiên trích xuất tiêu chí dưới dạng JSON; server lọc `Food` bằng code và chỉ
  dùng các entity đang phục vụ.
- Lượt AI thứ hai viết câu trả lời từ danh sách món đã lọc. Danh sách gửi vào prompt bị
  giới hạn 15 món; số thẻ trả về mỗi lượt luôn nằm trong **1..5**. Cấu hình `max_suggestions`
  trong trang Chatbot bị kẹp về khoảng này, nên giá trị cũ 8/10 cũng không vượt 5.
- Thẻ món phía client được tạo từ entity đã lọc (`FoodCard.from`), nên ID và giá không lấy
  từ câu trả lời AI. Thẻ mang thêm `portions` và `totalPrice` do server tính, nên giá hiển thị
  khớp với tổng tiền khách sẽ phải trả.
- `AiClient` đọc nhà cung cấp và tên mô hình từ bảng cấu hình `ai_setting` (quản trị viên đặt
  trong trang Chatbot), chỉ fallback về `app.ai.provider` / `app.ai.model` khi chưa đặt. Cả
  Gemini và OpenAI đều được hỗ trợ; `RestClient` có timeout 15 giâp cho cả kết nối và đọc.
- **Ngữ cảnh hỏi tiếp nằm ở client, không lưu vào CSDL.** `ChatRequest` nhận thêm `history`
  (tối đa 3 câu hỏi gần nhất) và `lastFoodIds` (ID các món ở tin bot gần nhất). Client xoá
  `foods` của mọi tin bot cũ nên chỉ tin mới nhất còn thẻ; ref `lastFoodIds` được cập nhật theo
  tin đó và clear khi tin mới không có món.
- `history` được đưa vào prompt trích xuất tiêu chí dưới nhãn "CÂU HỎI TRƯỚC CỦA KHÁCH" để AI
  hiểu "món đó", "món vừa gợi ý". Với khách đã đăng nhập, server dùng lịch sử phiên trong
  `chat_message` khi client không gửi gì.
- `lastFoodIds` chỉ được dùng khi câu mới là hỏi tiếp thật sự: có cụm tham chiếu rõ ("món đó",
  "cái đó", "món này", "món vừa gợi ý", "mấy món trên", "trong số đó") **và** tiêu chí không mở
  chủ đề mới (`categories`, `keywords`, `dietaryTags`, `excludeAllergens` đều rỗng). Khi đó
  server lấy đúng các `Food` theo ID rồi áp ràng buộc mới (cay, ngân sách, số người). Câu mở
  chủ đề mới bỏ qua context và tìm trên toàn thực đơn. Không dùng độ dài câu để đoán hỏi tiếp.
  Nhánh dự phòng khi AI lỗi cũng bám `lastFoodIds` nếu câu là hỏi tiếp.
- Lỗi AI/JSON sai thì xử lý bằng `try/catch` → hệ thống vẫn chạy bình thường. JSON AI trả về có
  thể có thêm trường lạ; mapper bỏ qua chúng (`FAIL_ON_UNKNOWN_PROPERTIES=false`) để một trường
  thừa không làm mất gợi ý.
- **Thiếu hoặc hỏng khóa API**: `AiClient.isConfigured()` kiểm tra `app.ai.api-key`; nếu rỗng,
  `chat()` ném `503 SERVICE_UNAVAILABLE` với câu "Trợ lý AI chưa được cấu hình, vui lòng thử
  lại sau." ngay trước khi lưu câu hỏi, nên không có lịch sử rác và không tốn thời gian chờ
  timeout. `GET /api/chatbot/status` trả `{ available, notice }` để client biết trước: khung chat
  hiện banner đúng câu trên, ô nhập và nút gửi bị khóa.
- **Khóa bị nhà cung cấp từ chối** (401/403, hoặc 400 kèm `API_KEY_INVALID` của Gemini) cũng bị
  coi là chưa cấu hình. `AiClient.verifyKey()` (được `/status` gọi) thử một câu tối giản ở lần
  đầu rồi nhớ kết quả, nên mở trang là banner hiện ngay; lỗi mạng/quota thì coi như dùng được và
  chỉ thử lại sau 5 phút. Khi bị từ chối, `AiClient` bật cờ dính (`credentialsRejected`, giữ tới
  khi khởi động lại) và `AiKeyRejectedException` được đẩy xuyên qua
  `extractCriteria`/`generateReply` để `chat()` đổi thành 503 thay vì dựng câu trả lời dự phòng.
  Lỗi 429/5xx, hết thời gian chờ mới đi nhánh dự phòng.
- **Nhánh dự phòng khi không gọi được AI** (429/5xx, JSON sai, hết thời gian chờ): `chat()`
  rơi sang `ChatbotService.selectFoodsByCode` + `fallbackReply`. Món được chấm điểm bằng code
  theo từ khoá trùng tên món/nguyên liệu/nhãn, tên danh mục chỉ tính khi câu hỏi có nguyên cụm
  tên danh mục, rồi áp các ràng buộc đọc được chắc chắn từ câu (không cay, chay, loại trừ hải
  sản, ngân sách, số người). Câu trả lời chỉ tóm tắt một dòng ("Mình tìm được 5 món chay, không
  cay, giá từ 35.000đ.") rồi mời khách bấm thẻ món, **không** liệt kê lại danh sách món vì
  thẻ món đã hiện ngay dưới. Câu hỏi ngoài lề thì không gợi ý món nào. Thẻ món vẫn lấy
  ID/giá từ CSDL nên không có chuyện AI bịa món.
- Prompt của lượt ghi câu trả lời có luật số 9: AI cũng không được liệt kê lại danh sách món,
  để câu trả lời của hai nhánh (AI và dự phòng) nhìn giống nhau.
- **Chỉ khách đã đăng nhập mới lưu lịch sử hội thoại.** Khách vãng lai vẫn chat được nhưng
  tin nhắn không ghi vào `chat_message`, nên lịch sử trong trang quản trị luôn gắn với tài khoản.
- **Lưu lịch sử cho khách vãng lai**: từ phiên bản này, cả khách chưa đăng nhập cũng được lưu `chat_message` với `user = null` theo `sessionId`, nên ngữ cảnh phiên hoạt động cho mọi khách. `recentTurns` đọc theo `sessionId` không phụ thuộc tài khoản.
- **Giải quyết đại từ tham chiếu**: server nhớ tên các món vừa gợi ý theo `sessionId` (bộ nhớ trong tiến trình). Nếu câu hỏi chứa đại từ ("món đó", "rẻ hơn"...) hoặc rất ngắn, server thêm tên các món đó vào câu hỏi trước khi trích tiêu chí, giúp AI không hiểu sai.
- **Validate tiêu chí**: `normalizeCriteria` loại bỏ giá trị vô lý (độ cay ngoài 0–3, ngân sách ≤ 0, số người ≤ 0/>50, chuỗi rỗng). Nếu bộ lọc từ khóa không khớp món nào, server bỏ lọc từ khóa nhưng vẫn giữ các ràng buộc thuộc tính, tránh trả danh sách rỗng vô lý.
- Không còn RAG/tài liệu tham khảo: chatbot chỉ dùng dữ liệu món trong DB và cấu hình AI
  (provider/model), nên không có tài liệu nào để nạp hay trích dẫn.

#### Bốn kiểu tư vấn và cách server lọc

Tiêu chí AI trả về gồm `categories` (loại món và số món mong muốn cho từng loại),
`maxSpicyLevel`, `maxBudget` (TỔNG ngân sách của cả bữa), `people`, `excludeAllergens`,
`dietaryTags` và `keywords`. `ChatbotService.selectFoods` áp chúng bằng code, theo hai bước:

1. **Lọc thuộc tính món**: còn phục vụ, độ cay, thành phần loại trừ (quét cả `allergens` lẫn
   `ingredients`), nhãn chế độ ăn, từ khóa. Danh mục và giá để dành cho bước 2.
2. **Chọn món theo ngân sách** (`maxBudget` là TỔNG của cả bộ gợi ý):
   - *Một loại món* (hoặc khách không nói rõ loại nào): `FlatBudgetPicker` dò tổ hợp trên tối
     đa 20 món rẻ nhất (bỏ trùng theo ID), chọn 1..5 món sao cho `sum(totalPrice) <= maxBudget`
     và tổng tiền lớn nhất; hoà tổng thì ưu tiên nhiều món hơn. Không có bộ nào vừa thì trả
     rỗng và câu trả lời nói rõ chưa có món trong ngân sách.
   - *Kết hợp nhiều loại* ("một món chính và một món uống"): mỗi loại giữ 5 ứng viên rẻ nhất
     rồi `BudgetCombiner` dò tổ hợp, giữ đúng số món mỗi nhóm và tổng không vượt ngân sách.
     Không ghép được thì trả rỗng, không lấy lệch loại món khách yêu cầu.
   - Không có `maxBudget`: giữ hành vi cũ, trả danh sách ứng viên và `chat()` cắt còn tối đa 5.

**Số người ăn và khẩu phần**: số phần cần của một món là `ceil(people / khẩu phần)`, ví dụ
4 người ăn, món phục vụ 2 người thì cần 2 phần. Tổng tiền của món là `giá × số phần`, và
ngân sách so với **tổng** số phần chứ không phải giá một phần. Số phần và tổng tiền được
ghi kèm vào prompt để AI đọc lại thay vì tự tính, và gửi kèm thẻ món ra client.

Nếu không tổ hợp nào vừa ngân sách (kể cả khi số người làm số phần tăng), server trả danh sách
rỗng và câu trả lời nói rõ chưa có món trong ngân sách; không tự bỏ yếu tố số người vì như vậy
giá hiển thị sẽ lệch với số người khách nói. Tổng bộ gợi ý và ngân sách được ghi vào prompt
trả lời (`TỔNG BỘ GỢI Ý`, `NGÂN SÁCH`) để AI không nói sai, và `fallbackReply` cũng tóm tắt
dạng "N món, tổng ... trong ngân sách ...".

### 5b. Ảnh món do admin tải lên

- `POST /api/admin/uploads/image` nhận JPG/PNG/WEBP tối đa 2 MB. Định dạng được xác định bằng
  **chữ ký đầu file**, không tin `Content-Type` do client khai.
- File nằm ở thư mục `app.upload.dir` (mặc định `uploads`), mount thành volume `uploads` trong
  `docker-compose.yml`, và được phục vụ lại qua `WebConfig` tại đường dẫn `/api/uploads/**`.
- Endpoint trả về **URL tuyệt đối** dựng từ `ServletUriComponentsBuilder`, nhờ vậy ảnh hiển thị
  được ở cả dev (Vite ở cổng khác) lẫn bản build qua nginx mà không phải sửa cấu hình proxy.

### 6. Đánh giá và đặt lại

- Khách chỉ được đánh giá món có trong **đơn hoàn thành** của chính mình
  (`existsByUserIdAndStatusAndItemsFoodId`), khớp yêu cầu "đánh giá sau khi dùng".
- Nội dung nhận xét **không bắt buộc**: khách có thể chỉ chọn số sao. `ReviewController` chuẩn hóa
  chuỗi rỗng hoặc chỉ khoảng trắng thành `null` ở cả tạo và sửa; cột `comment` vốn đã nullable nên
  không cần đổi CSDL.
- `GET /api/reviews/food/{foodId}` trả kèm cờ `mine` để client biết đánh giá nào của chính
  mình và chỉ hiện nút Sửa/Xóa ở đúng đánh giá đó. `PUT` và `DELETE /api/reviews/{id}` đều kiểm
  tra chủ sở hữu ở server, không tin cờ `mine` từ client.
- Trang lịch sử đơn có nút **Đặt lại** (chỉ render khi đơn `COMPLETED` theo điều kiện trong
  `OrdersPage`): đưa toàn bộ món (còn phục vụ) của đơn cũ vào giỏ, món ngừng phục vụ bị bỏ qua
  kèm cảnh báo, rồi mở drawer giỏ tại chỗ. Nút **Hủy đơn** đi qua helper `canCancelOrder`
  (`client/src/utils/orders.ts`) cùng ràng buộc với `OrderService.cancel`: đơn `PENDING` chưa
  thanh toán; đơn `PENDING` đã `PAID` thay nút bằng gợi ý gọi hotline.

### 7. Thông báo

- Chuông không còn là nút riêng trên header: mục "Thông báo" nằm trong menu tài khoản và mở
  `NotificationsDrawer` bên phải. Avatar có chấm đỏ khi còn thông báo chưa đọc; số chưa đọc
  cũng hiện cạnh nhãn trong menu. `store/notificationStore.ts` là nguồn dữ liệu chung cho cả
  header và drawer, trước đây hai nơi gọi API riêng nên dễ lệch số.
- Mỗi thông báo gắn `orderId` nullable của đơn liên quan, do `OrderService.notify` set. Cột mới
  được `ddl-auto=update` tự thêm; thông báo tạo trước thay đổi này có `orderId = null`.
- Các thao tác giữ nguyên một bộ endpoint: `POST /api/notifications/read-all`,
  `POST /api/notifications/{id}/read`, `DELETE /api/notifications/read` (xóa các thông báo đã đọc)
  và `DELETE /api/notifications/{id}`. Endpoint thao tác một thông báo kiểm tra chủ sở hữu như
  xóa: 404 khi không tồn tại, 403 khi của người khác.
- Bấm vào thân thông báo: đánh dấu đã đọc, đóng drawer, và nếu có `orderId` thì điều hướng
  `/orders?orderId=...`; trang đơn cuộn tới thẻ `order-{id}` và tô ring để chỉ đúng đơn. Thông báo
  cũ không có `orderId` chỉ mark read rồi đóng drawer.
- Nút "Xóa đã đọc" xóa mọi thông báo `read = true` của chính người dùng. Nút xóa từng thông báo
  luôn hiện trên mobile, còn desktop chỉ hiện khi hover hoặc focus.

## Giao diện khách hàng và giao diện quản trị

Hai nhóm dùng hai layout riêng, đúng yêu cầu "tách riêng trang quản trị với trang khách hàng":

- `DefaultLayout` bọc route khách: thanh điều hướng, `CartDrawer`, `NotificationsDrawer` và
  khung chatbot nổi, không có chân trang. Chiều cao header nằm ở biến `--header-h`; trang thực
  đơn khoá `calc(100dvh - var(--header-h))` và cuộn trong vùng riêng, các trang còn lại cuộn
  theo tài liệu.
- `AdminLayout` bọc `/admin/*`: menu trái chia nhóm Bán hàng (Tổng quan, Đơn hàng, Khách hàng),
  Thực đơn (Món ăn, Danh mục), Marketing (Khuyến mãi), Hệ thống (Chatbot, Báo cáo);
  thu gọn thành drawer ở màn hình nhỏ. Vào `/admin` mặc định mở `/admin/dashboard`. Route admin
  không nằm trong `DefaultLayout`, nên không có khung chatbot hay thanh điều hướng của khách.

### Trang tổng quan quản trị

`/admin/dashboard` là trang mở đầu của khu quản trị và cố ý **không** dùng thẻ màu mè hay biểu
đồ cầu kỳ: một hàng chỉ số ngăn bằng đường kẻ mảnh, danh sách đơn chờ xác nhận kèm nút duyệt
ngay tại chỗ, và món bán chạy với thanh một màu. Việc cần làm nằm trên đầu trang, số liệu lấy
từ `/api/admin/reports/*` tính trong 30 ngày gần nhất. Doanh thu trên trang này là doanh thu
**sau giảm giá**, khớp với trang Báo cáo, nên hai nơi không bao giờ lệch nhau.

### Trang thực đơn kiểu kiosk

Trang chủ chính là trang thực đơn (`/`), khớp Bảng 2.22 gộp "Trang chủ / Thực đơn" làm một
màn hình. Cấu trúc từ trên xuống:

- **Hero ngắn** (`components/home/HomeHero.tsx`) chỉ hiện khi chưa có bộ lọc: địa bàn Cần Thơ,
  số món và số danh mục thật, hai nút "Xem thực đơn" và "Hỏi trợ lý AI" (mở chat qua `uiStore`).
- **Dải danh mục có ảnh** (`CategoryRail`) dùng `Category.imageUrl` sẵn có trong DB, cuộn ngang
  trên mobile; chọn danh mục ghi `?category=` và cuộn tới lưới món.
- **Ưu đãi hôm nay** (`DealRail`) lấy tối đa 4 món có `discountPercent > 0` do server tính, kèm
  nút "Xem tất cả" bật bộ lọc `deal=1`. Không tự đoán chương trình nào đang chạy.
- **Lưới món** 2 cột dưới `md`, 4 cột từ `md` (`grid-cols-2 md:grid-cols-4`), mỗi lượt 12 món
  (`PAGE_SIZE` chia hết cho 2 và 4). Bấm "Tải thêm món" nối thêm 12 món thay vì phân trang rời.
- **Bộ lọc nằm trên URL**: `category`, `keyword`, `min`, `max`, `sort`, `diet`, `spicy`,
  `available`, `deal`. Nhờ vậy chia sẻ được đường dẫn đã lọc, nút quay lại giữ nguyên trạng thái
  và ô tìm kiếm trên header điều khiển được trang này. Bộ lọc nhanh (Còn món, Món chay, Không
  cay, Đang giảm) và 5 dải giá lọc trên danh sách đã tải; sắp xếp theo giá hoặc mức giảm chạy
  trên client vì dữ liệu từng món đã đủ.
- **Thanh giỏ ghim đáy** hiện khi giỏ có món, ghi số món và số phần, nút "Xem giỏ" mở drawer
  chứ không rời trang.
- Tìm kiếm khớp **không dấu, không phân biệt hoa thường**: server bỏ điều kiện `LIKE` khỏi
  Specification và lọc từ khoá bằng Java qua `TextNormalizer` (NFD bỏ dấu, đ/Đ → d) sau
  `findAll` — không cầu extension `unaccent` của PostgreSQL. Enter trong ô tìm kiếm áp dụng
  ngay qua `commitSearch` dùng chung với debounce: ở `/` giữ nguyên `category`/`min`/`max`,
  ở trang khác thì về `/` kèm từ khoá thay vì làm rỗng bộ lọc.

Thẻ món giữ mật độ cũ: ảnh 16:10, đệm `p-2.5` trên mobile và `p-3` từ `sm`, tối đa 2 nhãn.
Giá dùng `food.discountedPrice ?? food.price` và hiện giá gốc gạch ngang khi đang giảm. Nút
"Thêm vào giỏ" **luôn hiện**: khách đã đăng nhập thêm xong chỉ thấy toast và ở lại trang chủ;
khách vãng lai được đưa sang `/login` rồi quay lại đúng bộ lọc. Cả thẻ mở trang chi tiết.

`/foods/:id` là **trang độc lập** trong `DefaultLayout`, không còn là route con hay Drawer.
Trang có hai cột từ `lg`: ảnh `4/3` (mobile) hoặc `2/1` (từ `sm`), khối thông tin món và đánh
giá; cột phải sticky chứa giá, số lượng và nút thêm. Dưới `lg` có thanh mua hàng cố định đáy.
Giá trên trang chi tiết dùng đúng một nguồn với thẻ món. Nút quay lại ưu tiên `state.from` do
thẻ món truyền vào (kèm query bộ lọc); vị trí cuộn của lưới được lưu trong `sessionStorage`
(`menu-scroll`) và khôi phục khi quay lại. Thêm món từ trang chi tiết mở drawer giỏ để khách
thấy ngay món vừa thêm. URL cũ `/foods` chuyển hướng về `/`.

### Trang đặt món

`/checkout` là URL chính và là trang duy nhất để chốt đơn; `/cart` chỉ chuyển hướng về đây.
Trang không lặp lại danh sách món sửa được (việc đó nằm trong drawer giỏ), chỉ còn:

- Thẻ địa chỉ đã lưu (chọn nhanh, thêm/sửa qua modal) và ba trường người nhận, số điện thoại,
  địa chỉ.
- Phương thức thanh toán dạng thẻ chọn (`COD` / `QR`), ghi chú cho quán kèm chip gợi ý.
- Cột tóm tắt sticky: số món, số phần, tạm tính, giảm giá, tổng thanh toán và nút xác nhận;
  dưới `lg` thanh đáy chỉ giữ tổng tiền và một nút đặt món. Nút "Sửa giỏ" mở drawer tại chỗ.
- Mọi con số vẫn lấy từ `useCartQuote`, nút xác nhận khoá khi quote đang tải hoặc lỗi.

### Thanh điều hướng và hệ nút

- Thanh điều hướng **một hàng ở mọi kích thước**: logo (`BrandMark`, bấm về `/`), ô tìm kiếm
  co giãn (`flex-1`), nút đơn hàng, nút giỏ, avatar hoặc nút đăng nhập. Chiều cao cố định
  `--header-h = 3.25rem`; chatbot, vùng cuộn kiosk và thanh đáy đều đọc biến này, không
  hard-code lại. Nút đơn hàng (icon `inbox`) chỉ hiện từ `md` khi đã đăng nhập vì `/orders` bắt
  buộc token. Không có menu điều hướng riêng; các đích còn lại nằm trong menu tài khoản (Thông
  báo, Đơn hàng của tôi, Tài khoản, Đăng xuất) và nút tắt sang khu quản trị nếu là admin.
- **Chuông không còn trên header**: mục "Thông báo" trong menu tài khoản mở
  `NotificationsDrawer`; avatar có chấm đỏ khi còn thông báo chưa đọc. Nhờ vậy header giữ được
  một hàng và ô tìm kiếm có đủ chỗ trên mobile.
- **Giỏ hàng là drawer**, không phải trang: `CartDrawer` rộng `min(420px, 100vw)`, danh sách
  món sửa số lượng/xoá tại chỗ, footer sticky hiện tạm tính, giảm giá, tổng và nút sang
  `/checkout`. Drawer chỉ mount nội dung khi mở nên không gọi báo giá ở mọi trang.
- Trang `/login` và `/register` (`AuthShell`) không còn hiển thị thương hiệu/link về bảng món;
  trang quản trị có logo riêng trong `AdminLayout`.
- `components/UiButton.tsx` là nút dùng chung, chỉ 6 dạng: `primary` (44px), `primary-lg`
  (52px, đúng 1 nút mỗi màn hình), `default`, `danger`, `icon` (40px), `fab` (64px, nút mở
  chatbot). Mọi kích thước, bo góc và màu nằm ở một chỗ. Kích thước ghi bằng tiền tố `!` vì
  AntD nạp CSS-in-JS sau Tailwind và ghi đè được chiều cao của nút. Chiều cao nằm ở bảng
  `HEIGHTS` tách khỏi kiểu dáng, mỗi cỡ một ô riêng: truyền class `!h-*` để ghi đè sẽ không
  ăn vì hai class `!important` bằng nhau thì Tailwind quyết định theo thứ tự sinh CSS, muốn
  nhỏ lại phải truyền `size="small"`.
- Thẻ món dùng nút "Thêm vào giỏ" **có nhãn** vì Bảng 2.22 ghi rõ tên thành phần này; món hết
  hiện nhãn "Hết món" và nút bị vô hiệu hoá. Nút chỉ có chữ, không kèm icon dấu "+".
- Màu chính AntD là `#b45309` (`theme.ts`), chữ trắng trên nền này đạt tương phản AA; sắc sáng
  hơn chỉ dùng cho logo và điểm nhấn lớn. `index.css` tôn trọng `prefers-reduced-motion` và giữ
  biến `--header-h` làm nguồn duy nhất cho chiều cao header.

### Chatbot nổi

Cụm widget bám trang: `fixed inset-x-0 bottom-0 top-[var(--header-h)]` cùng `justify-end`, khung
chat `flex-1` nên tự co theo chiều cao màn hình thay vì hard-code. Vùng trống của cụm mang
`pointer-events-none` nên không chặn thao tác lên thẻ món phía sau. Trạng thái mở/đóng nằm
trong `store/uiStore.ts`, nhờ vậy hero và empty state mở chat được mà không cần đi qua nút nổi.
Launcher là `UiButton` dạng `fab` 64px; `useHasBottomBar()` trả `cart | checkout | detail | null`
để launcher nhường chỗ cho thanh giỏ, thanh đặt món hoặc thanh mua hàng của trang chi tiết.

Bố cục khung chat:

- Tin bot và tin khách đều nằm trong bong bóng: bot là bong bóng trắng căn trái (`rounded-bl-md`,
  viền mảnh), khách là bong bóng hổ phách căn phải (`rounded-br-md`). Ô chữ của bot rộng tối đa
  92%, của khách 85%.
- Bốn câu gợi ý là một dải chip **luôn nằm trên ô nhập**, cuộn ngang trên mobile, không biến
  mất sau tin đầu tiên; chip bị khoá khi trợ lý chưa cấu hình hoặc đang chờ trả lời. Cả bốn
  câu đều chạy đúng bộ lọc thật: chế độ ăn + độ cay, ngân sách + số người (số phần tính theo
  khẩu phần), thành phần loại trừ, và kết hợp món theo tổng ngân sách.
- Nút **Làm mới hội thoại** trên thanh tiêu đề xoá ngữ cảnh cũ (tin nhắn, `lastFoodIds`,
  `sessionId` mới) để câu hỏi tiếp không dính vào món của lượt trước. Tin bot chạy chữ dần; ai
  bật `prefers-reduced-motion` thì thấy ngay toàn bộ câu trả lời.
- Thẻ món gộp trong **một khung trắng**, các dòng ngăn bằng đường kẻ, không viền riêng từng
  thẻ: ảnh 40px, tên một dòng, giá hổ phách căn phải. Cả dòng là liên kết tới `/foods/:id`.
  Khung này canh cùng mép trái với bong bóng của bot.
- **Chỉ tin bot mới nhất giữ thẻ món**, tối đa 5 thẻ. Khi nhận tin bot mới, client bỏ thuộc
  tính `foods` của mọi tin bot cũ (vẫn giữ nội dung chữ) rồi gắn thẻ của tin mới. Nhờ vậy khung
  chat không dồn thẻ và khách không tưởng món của lượt cũ là gợi ý hiện tại.
- Nút thêm vào giỏ trong thẻ yêu cầu đăng nhập: khách vãng lai thấy nút disabled kèm tooltip
  "Đăng nhập để thêm món vào giỏ" và bấm vào không điều hướng theo link của thẻ.
- Khi server thiếu khóa AI, `GET /api/chatbot/status` trả `available = false`; khung chat hiện
  banner hổ phách ngay dưới thanh tiêu đề, khóa ô nhập, nút gửi và các chip gợi ý. `ChatResponse`
  chỉ còn `reply` + `foods`. Nếu vẫn nhận 503 lúc gửi (trạng thái đổi sau khi mở khung), client
  báo đúng câu đó và khóa khung chat thay vì mời thử lại.
- Nút gửi nằm trong ô nhập (`suffix`) thay vì một nút tròn riêng, nên khung chat đỡ một phần
  tử và ô nhập không bị bó hẹp.
- Ba chấm "đang trả lời" cũng nằm trong bong bóng trắng cùng kiểu để khung nhìn nhất quán.

Phía server, `extractCriteria` trả `null` khi AI lỗi hoặc JSON sai. `chat()` không coi tiêu
chí rỗng là khớp mọi món (làm vậy khách hỏi món chay sẽ nhận cà phê đá), mà chuyển sang nhánh
dự phòng chấm điểm bằng code. Khi trích xuất thành công nhưng sinh câu trả lời thất bại thì
thẻ món của bước lọc vẫn hiện, vì chúng khớp thật câu hỏi.

Tài liệu tri thức mẫu không được hứa điều mà hệ thống không làm: `OrderService.create` chỉ cộng
tiền món nên tài liệu đã bỏ câu "Phí giao hàng 15.000 đồng". Ba câu còn lại (giờ mở cửa, khu vực
không phục vụ, thời gian giao) là thông tin, không sinh ra con số sai về tiền, nhưng cũng
không có code kiểm chứng.

## Cấu trúc mã nguồn

```
server/src/main/java/com/foodordering/
  config/  cấu hình (AppProperties, DataSeeder, WebConfig, SecurityConfig)
  security/ JwtUtil, JwtFilter
  entity/  JPA entities
  repository/  Spring Data JPA repositories
  dto/     request/response (đồng bộ thủ công với types client)
  service/ nghiệp vụ (OrderService, CartService, PricingService, PromotionService,
           ChatbotService, AiClient, ReportService, AuthService, FoodService)
  controller/  mapping dưới /api/...

client/src/
  main.tsx  App.tsx(router)  api/  store/(Zustand)  types/  components/
  pages/    layouts/  hooks/  utils/  index.css
```

Sửa DTO phải cập nhật cả `client/src/types/index.ts` và `client/src/api/api.ts`.

## Môi trường & chạy

Bí mật nằm trong một file `.env` ở root (copy từ `.env.example`): `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`. Compose tự dựng
`DB_URL`; `AI_PROVIDER` mặc định `gemini`, `UPLOAD_DIR=/app/uploads` trong container.
`mvn spring-boot:run` **không tự đọc `.env`** — phải export tay hoặc chạy qua compose.

- Dev: `docker compose --profile dev up --build` (client http://localhost:5173, server :8080)
- Prod: `docker compose --profile prod up --build -d` (client http://localhost)
- `docker compose up` (không profile): chỉ Postgres.
- Server dev hot reload: trong container chỉ mount mã nguồn nên cần terminal riêng chạy
  `docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"`
  (hoặc để IDE biên dịch vào `server/target/classes`). Client dev dùng Vite HMR, không cần build lại
  image trừ khi đổi `package.json`.

## Kiểm thử

Server có 3 test class (`PricingServiceTest`, `ChatbotServiceTest`, `OrderDtosValidationTest`),
chạy độc lập không cần DB. Client chưa có test runner; kiểm tra bằng `npm run typecheck` và `npm run build`.

## Quy tắc quan trọng khi làm việc

- Không Flyway; schema do Hibernate `ddl-auto: update` tự đồng bộ.
- Seed chỉ chạy khi bảng `users` trống; đổi dữ liệu mẫu thì DB cũ giữ nguyên — reset bằng
  `docker compose --profile prod down -v`.
- Mọi quy tắc giảm giá sửa ở `PricingService`, đừng tính lại ở React.
- Sửa endpoint/DTO/quy tắc domain → cập nhật đồng bộ `AGENTS.md`, `ARCHITECTURE.md`, `TEST.md`.
- Không giữ bí mật trong code; chỉ trong `.env`.
