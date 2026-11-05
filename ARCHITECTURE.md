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
  tooltip "Đăng nhập để thêm món vào giỏ". `/cart` nằm trong `RequireAuth`, nên bấm nút giỏ trên
  header hoặc mở thẳng đường dẫn đều bị đưa sang `/login` và quay lại đúng trang sau khi đăng
  nhập. `cartStore.add` trả `false` khi chưa đăng nhập như lớp phòng thủ thứ hai.
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

- **Đồng bộ báo giá ở client**: mỗi lần `items` đổi, `CartPage` abort request quote cũ và xoá
  quote hiện tại trước khi gọi lại. Trong lúc chờ hoặc khi lỗi, khối tổng hiện "Đang cập nhật
  giá..." và nút "Xác nhận đặt món" bị khoá; dòng món vẫn tạm hiện giá gốc từ cart item.
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
  giới hạn 15 món; số thẻ trả về mặc định là 5 và có thể đổi trong cấu hình chatbot.
- Thẻ món phía client được tạo từ entity đã lọc (`FoodCard.from`), nên ID và giá không lấy
  từ câu trả lời AI. Thẻ mang thêm `portions` và `totalPrice` do server tính, nên giá hiển thị
  khớp với tổng tiền khách sẽ phải trả.
- `AiClient` đọc nhà cung cấp và tên mô hình từ bảng cấu hình `ai_setting` (quản trị viên đặt
  trong trang Chatbot), chỉ fallback về `app.ai.provider` / `app.ai.model` khi chưa đặt. Cả
  Gemini và OpenAI đều được hỗ trợ; `RestClient` có timeout 15 giâp cho cả kết nối và đọc.
- Câu hỏi tiếp theo của cùng phiên được đưa vào ngữ cảnh lượt ghi câu trả lời, để khách hỏi
  tiếp về món vừa được gợi ý mà AI vẫn biết đang nói về món nào.
- Lỗi AI/JSON sai thì xử lý bằng `try/catch` → hệ thống vẫn chạy bình thường. JSON AI trả về có
  thể có thêm trường lạ; mapper bỏ qua chúng (`FAIL_ON_UNKNOWN_PROPERTIES=false`) để một trường
  thừa không làm mất gợi ý.
- **Nhánh dự phòng khi không gọi được AI** (thiếu khóa, khóa hỏng, hết thời gian chờ): `chat()`
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
2. **Chọn món theo ngân sách**:
   - *Một loại món* (hoặc khách không nói rõ loại nào): lấy các món rẻ nhất còn nằm trong
     tổng ngân sách.
   - *Kết hợp nhiều loại* ("một món chính và một món uống"): mỗi loại giữ 5 ứng viên rẻ nhất
     rồi dò tổ hợp, chọn tổ hợp có tổng tiền cao nhất nhưng không vượt ngân sách.

**Số người ăn và khẩu phần**: số phần cần của một món là `ceil(people / khẩu phần)`, ví dụ
4 người ăn, món phục vụ 2 người thì cần 2 phần. Tổng tiền của món là `giá × số phần`, và
ngân sách so với **tổng** số phần chứ không phải giá một phần. Số phần và tổng tiền được
ghi kèm vào prompt để AI đọc lại thay vì tự tính, và gửi kèm thẻ món ra client.

Nếu số người AI đoán ra quá lớn khiến không món nào vừa ngân sách, server thử lại bỏ yếu tố
số người để lượt hỏi đó vẫn gợi ý được món thay vì trả về danh sách rỗng.

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
  kèm cảnh báo. Nút **Hủy đơn** đi qua helper `canCancelOrder` (`client/src/utils/orders.ts`)
  cùng ràng buộc với `OrderService.cancel`: đơn `PENDING` chưa thanh toán; đơn `PENDING` đã
  `PAID` thay nút bằng gợi ý gọi hotline.

### 7. Thông báo

- Mỗi thông báo gắn `orderId` nullable của đơn liên quan, do `OrderService.notify` set. Cột mới
  được `ddl-auto=update` tự thêm; thông báo tạo trước thay đổi này có `orderId = null`.
- Các thao tác giữ nguyên một bộ endpoint: `POST /api/notifications/read-all`,
  `POST /api/notifications/{id}/read`, `DELETE /api/notifications/read` (xóa các thông báo đã đọc)
  và `DELETE /api/notifications/{id}`. Endpoint thao tác một thông báo kiểm tra chủ sở hữu như
  xóa: 404 khi không tồn tại, 403 khi của người khác.
- Bấm vào thân thông báo: đánh dấu đã đọc, đóng popover, và nếu có `orderId` thì điều hướng
  `/orders?orderId=...`; trang đơn cuộn tới thẻ `order-{id}` và tô ring để chỉ đúng đơn. Thông báo
  cũ không có `orderId` chỉ mark read rồi đóng popover.
- Nút "Xóa đã đọc" xóa mọi thông báo `read = true` của chính người dùng. Nút xóa từng thông báo
  luôn hiện trên mobile, còn desktop chỉ hiện khi hover hoặc focus.

## Giao diện khách hàng và giao diện quản trị

Hai nhóm dùng hai layout riêng, đúng yêu cầu "tách riêng trang quản trị với trang khách hàng":

- `DefaultLayout` bọc route khách: chỉ có thanh điều hướng và khung chatbot nổi, không có chân
  trang. Trang bảng món tự khoá chiều cao `100dvh - 3.25rem` và cuộn trong vùng riêng.
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

### Bảng món kiểu kiosk

Trang chủ chính là trang thực đơn (`/`), khớp Bảng 2.22 gộp "Trang chủ / Thực đơn" làm một
màn hình:

- **Không còn khối danh mục riêng**: danh mục hiện là chip lọc ngang trên bảng món, còn toàn bộ
  món hiển thị trong một lưới chung với phân trang 12 món mỗi trang.
- Panel chi tiết món dùng ảnh `4/3` trên mobile, `2/1` từ `sm` để không chiếm gần hết
  chiều cao Drawer trên desktop.
- **Không còn khối voucher trên trang chủ**: voucher chào mừng tự vào ví, mã đã nhận chọn ở bước
  thanh toán trong giỏ. API nhận voucher và quà may mắn vẫn còn ở server nhưng hiện không có nút
  trên giao diện khách.
- Thẻ món gắn nhãn ưu đãi tự động (`Hôm nay`, `Cuối tuần`, `Dịp lễ`) cạnh nhãn `-N%`, lấy từ
  `discountLabel` do server điền theo `Promotion.occasion`.
- Lọc khoảng giá bằng 5 dải giá dạng sẵn (dễ chạm hơn hai ô nhập số). Từ `md` trở lên dải giá
  nằm **cùng hàng** với chip danh mục: danh mục co giãn và cuộn ngang, dải giá giữ nguyên một
  hàng không rơi xuống. Dưới `md` dải giá `flex-wrap` xuống nhiều dòng nên không bị cắt. Cả thanh
  dính đầu vùng lưới (`sticky top-0`), chip thấp 32px (`py-1.5`, `text-xs`) để không chiếm chỗ.
  Mục đầu ghi "Mọi giá" chứ không phải "Tất cả"
  vì hàng trên đã có "Tất cả", hai chữ giống nhau cạnh nhau dễ bị hiểu là một bộ lọc.
- Lưới thẻ món cuộn trong vùng riêng, phân trang 12 món mỗi trang (`PAGE_SIZE` chia hết cho cả
  2 và 4 nên không trang nào lẻ hàng). Số cột: 2 cột dưới `md`, 4 cột từ `md`
  (`grid-cols-2 md:grid-cols-4`), không còn 3 hay 5 cột.
- Thanh giỏ ghim đáy hiện khi giỏ có món, chứa tổng tiền và nút "Xem giỏ và đặt món".
- Toàn bộ bộ lọc nằm trên URL (`category`, `keyword`, `min`, `max`) nên người dùng chia sẻ
  được đường dẫn đã lọc và ô tìm kiếm trên thanh điều hướng điều khiển được trang này.
- Tìm kiếm khớp **không dấu, không phân biệt hoa thường**: server bỏ điều kiện `LIKE` khỏi
  Specification và lọc từ khoá bằng Java qua `TextNormalizer` (NFD bỏ dấu, đ/Đ → d) sau
  `findAll` — không cầu extension `unaccent` của PostgreSQL. Enter trong ô tìm kiếm áp dụng
  ngay qua `commitSearch` dùng chung với debounce: ở `/` giữ nguyên `category`/`min`/`max`,
  ở trang khác thì về `/` kèm từ khoá thay vì làm rỗng bộ lọc.

Thẻ món được nén để nhìn thấy được nhiều món hơn trên một màn hình: ảnh cắt theo 16:10 (thay
4:3), đệm `p-2.5` trên mobile và `p-3` từ `sm`, tối đa 2 nhãn, giá `text-base` trên mobile và
`text-lg` từ `sm`. Dưới `sm` giá và nút xếp dọc, nút "Thêm vào giỏ" dùng `size="small"` chữ
`text-xs` và rộng hết thẻ; từ `sm` chúng quay lại một hàng. Ở 360px thẻ rộng khoảng 162px, phần
nội dung 142px, đủ chỗ cho ảnh, giá và nút nên không tràn ngang. Đo ở cửa sổ 848×670: chiều cao
thẻ 444px xuống 285px, vùng lưới tăng từ 546px lên 614px.

`/foods/:id` là **route con** của `/` và hiển thị thành panel phủ (`Drawer`) chứ không phải trang
riêng. Nhờ vậy người dùng không rời bảng món khi xem chi tiết, URL vẫn thật để thẻ món trong
chatbot liên kết được, và nút quay lại của trình duyệt đóng được panel. Panel dùng bố cục: ảnh
4/3, giá và trạng thái, mô tả, lưới thông số, hàng số lượng + tổng tiền + nút thêm.
URL cũ `/foods` chuyển hướng về `/`.

### Thanh điều hướng và hệ nút

- Thanh điều hướng có 5 thành phần Bảng 2.22: nút trang chủ, ô tìm kiếm, đơn hàng, giỏ hàng,
  đăng nhập, cộng ô thông báo. Nút đơn hàng (icon `inbox`, cạnh nút giỏ hàng) chỉ hiện khi đã đăng
  nhập vì route `/orders` bắt buộc token; khách vãng lai vẫn vào được `/orders` qua
  `RequireAuth` nhưng không thấy nút này. Không có menu điều hướng tới các trang con; những
  đích đó nằm trong menu tài khoản (Đơn hàng của tôi, Tài khoản, Trang quản trị nếu là admin,
  Đăng xuất). Header cao `3.25rem`, các nút trong header dùng `size="small"` (36px). Ô tìm
  kiếm có `md:max-w-xl`: không chặn bề rộng thì trên màn hình rộng nó giãng hết chỗ trống và
  đẩy nhóm nút bên phải lệch ra rìa.
- **Logo không nằm ở thanh điều hướng**: chỗ ấy để nút trang chủ (icon `home`) quay về bảng món.
  Trang `/login` và `/register` (`AuthShell`) không còn hiển thị thương hiệu/link về bảng món;
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

### Chatbot nổi

Cụm widget bám trang: `fixed inset-x-0 bottom-0 top-14` cùng `justify-end`, khung chat `flex-1`
nên tự co theo chiều cao màn hình thay vì hard-code. Vùng trống của cụm mang
`pointer-events-none` nên không chặn thao tác lên thẻ món phía sau. Launcher là `UiButton`
dạng `fab` 64px; nó tự nhảy lên cao hơn khi trang đang có thanh giỏ ghim đáy
(`useHasCartBar`).

Bố cục khung chat:

- Tin bot và tin khách đều nằm trong bong bóng: bot là bong bóng trắng căn trái (`rounded-bl-md`,
  viền mảnh), khách là bong bóng hổ phách căn phải (`rounded-br-md`). Ô chữ của bot rộng tối đa
  92%, của khách 85%.
- Ô gợi ý dính ngay dưới câu chào vì nó thuộc câu chào, và biến mất sau tin nhắn đầu tiên.
  Bốn câu gợi ý đều chạy đúng bộ lọc thật: chế độ ăn + độ cay, ngân sách + số người
  (số phần tính theo khẩu phần), thành phần loại trừ, và kết hợp món theo tổng ngân sách.
- Thẻ món gộp trong **một khung trắng**, các dòng ngăn bằng đường kẻ, không viền riêng từng
  thẻ: ảnh 40px, tên một dòng, giá hổ phách căn phải. Cả dòng là liên kết tới `/foods/:id`.
  Khung này canh cùng mép trái với bong bóng của bot.
- Khi tin bot không kèm món nào, hiện nút **"Xem thực đơn"** mở `/`, chỉ ở tin bot gần nhất
  để khung chat không bị dồn nút. Quy tắc này không cần field riêng trong DTO nên `ChatResponse`
  giữ nguyên `reply` + `foods`.
- Nút gửi nằm trong ô nhập (`suffix`) thay vì một nút tròn riêng, nên khung chat đỡ một phần
  tử và ô nhập không bị bó hẹp.
- Ba chấm "đang trả lời" cũng nằm trong bong bóng trắng cùng kiểu để khung nhìn nhất quán.

Phía server, `extractCriteria` trả `null` khi AI lỗi hoặc JSON sai. `chat()` coi `null` là
"không phân tích được" và **không gợi ý món**. Lý do: tiêu chí rỗng sẽ khớp mọi món, danh
sách trả về chỉ là vài món rẻ nhất, khách hỏi món chay sẽ nhận cà phê đá. Khi trích xuất thành
công nhưng sinh câu trả lời thất bại thì thẻ món vẫn hiện, vì chúng khớp thật câu hỏi.

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
