# Kiến trúc FoodOrdering

Tài liệu mô tả cách FoodOrdering vận hành: các thành phần, luồng dữ liệu, xác thực, chatbot và những quy ước quan trọng khi làm việc.

## Tổng quan

FoodOrdering là ứng dụng **đặt món trực tuyến** theo mô hình monorepo gồm client và server. Điểm khác biệt là **trợ lý AI** tư vấn món ăn theo ngôn ngữ tự nhiên, gợi ý luôn nằm trong thực đơn thật và đặt được ngay.

```
┌──────────────────┐       VITE_API_URL (Bearer JWT)       ┌──────────────────────┐
│  Vite SPA client │  ───────────────────────────────────▶  │  Spring Boot server  │
│(React + antd 6)  │  ◀───────────────────────────────────  │  Java 25 + JPA       │
└──────────────────┘                                        └──────────┬───────────┘
                                                                             │
                                                       PostgreSQL 18 (ddl-auto: update)
```

- **client/**: React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + Zustand 5 + Axios + React Router 7. SPA thuần, không SSR. UI tiếng Việt. `client/src/api/http.ts` dùng `VITE_API_URL` làm `baseURL` (mặc định `http://localhost:8080/api`). Vite hiện không có proxy `/api`; nginx ở prod chỉ phục vụ static SPA và fallback route.
- **server/**: Spring Boot 3.5 (Java 25) + Spring Security (JWT access token đơn giản) + Spring Data JPA. Package gốc `com.foodordering`, layered `controller` → `service` → `repository`.
- **PostgreSQL**: `ddl-auto: update` đồng bộ schema khi khởi động (không dùng Flyway).

## Luồng dữ liệu chính

### 1. Xác thực (JWT access token)

1. Client gọi `POST /api/auth/login` hoặc `POST /api/auth/register` với email và mật khẩu.
2. Server trả về access token JWT kèm thông tin user và role (ADMIN / CUSTOMER).
3. `authStore` lưu phiên theo lựa chọn remember: `localStorage` hoặc `sessionStorage`.
4. `api/http` gắn `Authorization: Bearer <token>` cho request. Hiện interceptor chỉ đọc
   `localStorage`, nên phiên dùng `sessionStorage` cần được đồng bộ ở code trước khi dùng đầy đủ.
5. `JwtFilter` trên server đọc và verify token, dựng `SecurityContext`. Token không hợp lệ bị nuốt, request được coi là chưa đăng nhập.
6. `SecurityConfig` stateless: yêu cầu `ROLE_ADMIN` cho `/api/admin/**`; phần còn lại dùng
   `authenticated()`, trừ các matcher được khai báo `permitAll()`.

Endpoint và chính sách public hiện tại:

- `SecurityConfig` đang `permitAll()` cho toàn bộ `/api/auth/**`; các endpoint nghiệp vụ
  dùng cho đăng nhập/đăng ký là `POST /api/auth/login` và `POST /api/auth/register`.
  `/api/auth/me` cần được bảo vệ khi siết matcher.
- `GET /api/foods/**`, `/api/categories/**`, `/api/reviews/**`.
- `POST /api/chatbot/chat`: tư vấn món, khách vãng lai vẫn dùng được. Matcher hiện
  permitAll cho toàn bộ `/api/chatbot/**`.
- `POST /api/reviews` yêu cầu đăng nhập vì chỉ có matcher GET được permitAll.

Bảo vệ route trên client chỉ là UX - **quyền ADMIN được kiểm soát ở server**.

### 2. Duyệt và tìm món

- Trang danh mục gọi `GET /api/foods` và `GET /api/categories`.
- Lọc theo tên, loại, khoảng giá và trạng thái available qua query params.
- Chi tiết món gồm thành phần, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, đánh giá.

### 3. Giỏ hàng (lưu theo tài khoản)

Giỏ hàng **lưu trên server** theo tài khoản (bảng `cart_items`, unique theo user + món):

- Khách đã đăng nhập: thêm/sửa/xóa/clear món qua `/api/cart/**` (yêu cầu xác thực); giỏ
  được lưu trong database và còn nguyên khi đăng nhập lại từ thiết bị khác.
- Khách vãng lai: giỏ nằm trong bộ nhớ của Zustand (không phải `localStorage` bền); khi
  đăng nhập, hệ thống đẩy bản nháp lên server rồi tải giỏ chính thức về. Khi đăng xuất,
  state giỏ của tài khoản được xóa khỏi client.
- Giá món hiển thị từ dữ liệu trả về khi duyệt món.

### 4. Đặt món (giá lấy từ DB)

1. Client gửi `POST /api/orders` với danh sách món + số lượng, thông tin người nhận,
   phương thức thanh toán và **ghi chú cho quán** (`note`, tối đa 255 ký tự, tuỳ chọn).
2. `OrderService.create` set `price` = giá trong DB, **không tin giá từ client**; từ chối món ngừng phục vụ.
3. Mỗi đơn được ghi một giao dịch thanh toán (`payment_transactions`: phương thức, số tiền,
   trạng thái PENDING/PAID) và tạo thông báo xác nhận cho khách (`notifications`).
4. Trạng thái đơn dùng các giá trị `PENDING`, `CONFIRMED`, `PREPARING`, `COMPLETED`, `CANCELLED`;
   trạng thái thanh toán dùng `UNPAID` hoặc `PAID`.
5. **Trạng thái đi đúng một chiều**: `PENDING → CONFIRMED → PREPARING → COMPLETED`, được canh
   trong `OrderService.isValidTransition`. Đơn đã `COMPLETED` hoặc `CANCELLED` không đổi trạng
   thái được. `CANCELLED` được phép từ mọi trạng thái chưa chốt. Client cũng lọc danh sách trạng
   thái hợp lệ bằng `allowedNextStatuses`, nhưng server mới là nơi quyết định.
6. Khách tự hủy được đơn của mình qua `PATCH /api/orders/{id}/cancel`, chỉ khi còn `PENDING`.
7. Thanh toán giả lập (COD / QR) - không tích hợp cổng thanh toán thật.
   Khách tự xác nhận đã trả qua `PATCH /api/orders/{id}/pay`; admin vẫn ghi nhận hoặc hoàn tác
   thủ công bằng `PATCH /api/admin/orders/{id}/payment?paid=...`. Mã QR trên `/orders` chỉ là
   hình minh hoạ sinh từ mã đơn (`FOOD-{id}-{tổng tiền}`), không mã hoá thông tin thật, và chỉ hiện với phương thức `QR`.
8. Admin có thể tạo, sửa và xoá đơn thay khách qua `/api/admin/orders` (UC12), trong đó sửa sẽ
   thay cả danh sách món và đồng bộ lại số tiền của giao dịch thanh toán.
9. Ghi chú `note` chỉ ghi lúc tạo đơn, không sửa được về sau. Nơi đọc: dòng "Lưu ý cho quán"
   trên thẻ đơn ở `/orders` và khối "Lưu ý cho quán" trong drawer chi tiết đơn của admin.
   Nút "Đặt lại" chỉ chuyển món sang giỏ, không mang theo ghi chú cũ.

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

### 5. Trợ lý AI tư vấn món (chống bịa món/giá)

Trợ lý AI dùng **hai lượt gọi AI, bốn bước xử lý** để AI không bao giờ tự nghĩ ra món hoặc giá:

```
Người dùng → Chatbot → (1) AI trích xuất tiêu chí (JSON)   [service/AiClient, jsonMode]
           → (2) Server truy vấn DB và lọc món bằng code xác định
           → (3) AI viết câu trả lời dựa TRÊN DANH SÁCH MÓN THẬT
           → (4) Thẻ món trả về client luôn lấy ID từ DB, không từ text AI
```

- Lượt AI đầu tiên trích xuất tiêu chí dưới dạng JSON; server lọc `Food` bằng code và chỉ
  dùng các entity đang phục vụ.
- Lượt AI thứ hai viết câu trả lời từ danh sách món đã lọc và tối đa 3 đoạn tài liệu liên quan.
  Danh sách gửi vào prompt bị giới hạn 15 món; số thẻ trả về mặc định là 5 và có thể đổi
  trong cấu hình chatbot.
- Thẻ món phía client được tạo từ entity đã lọc (`FoodCard.from`), nên ID và giá không lấy
  từ câu trả lời AI. Thẻ mang thêm `portions` và `totalPrice` do server tính, nên giá hiển thị
  khớp với tổng tiền khách sẽ phải trả.
- `AiClient` đọc nhà cung cấp và tên mô hình từ bảng cấu hình `ai_setting` (quản trị viên đặt
  trong trang Chatbot), chỉ fallback về `app.ai.provider` / `app.ai.model` khi chưa đặt. Cả
  Gemini và OpenAI đều được hỗ trợ; `RestClient` có timeout 15 giâp cho cả kết nối và đọc.
- Câu hỏi tiếp theo của cùng phiên được đưa vào ngữ cảnh lượt ghi câu trả lời, để khách hỏi
  tiếp về món vừa được gợi ý mà AI vẫn biết đang nói về món nào.
- Lỗi AI/JSON sai thì xử lý bằng `try/catch` → tiêu chí rỗng, hệ thống vẫn chạy bình thường.
  Khi lượt ghi câu trả lời lỗi, chatbot trả thông báo dự phòng và vẫn gửi kèm thẻ món lọc
  được, nên khách không bị màn hình trắng. JSON AI trả về có thể có thêm trường lạ; mapper
  bỏ qua chúng (`FAIL_ON_UNKNOWN_PROPERTIES=false`) để một trường thừa không làm mất gợi ý.
- **Chỉ khách đã đăng nhập mới lưu lịch sử hội thoại.** Khách vãng lai vẫn chat được nhưng
  tin nhắn không ghi vào `chat_message`, nên lịch sử trong trang quản trị luôn gắn với tài khoản.
- RAG cơ bản (`KnowledgeService`) tách tài liệu thành đoạn 500 ký tự, chấm điểm theo từ khóa,
  hỗ trợ PDF/DOCX/TXT/MD, không cần vector DB. Admin upload tài liệu qua
  `POST /api/admin/chatbot/documents` (giới hạn request 10 MB). Tài liệu không trích được
  chữ (file rỗng, PDF scan) bị từ chối thay vì lưu một bản ghi vô dụng.

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
- Trang lịch sử đơn có nút **Đặt lại**: đưa toàn bộ món (còn phục vụ) của đơn cũ vào giỏ,
  món ngừng phục vụ bị bỏ qua kèm cảnh báo.

## Giao diện khách hàng và giao diện quản trị

Hai nhóm dùng hai layout riêng, đúng yêu cầu "tách riêng trang quản trị với trang khách hàng":

- `DefaultLayout` bọc route khách: chỉ có thanh điều hướng và khung chatbot nổi, không có chân
  trang. Trang bảng món tự khoá chiều cao `100dvh - 4rem` và cuộn trong vùng riêng.
- `AdminLayout` bọc `/admin/*`: menu bên trái 5 mục Món ăn, Danh mục, Đơn hàng, Khách hàng,
  Chatbot; thu gọn thành drawer ở màn hình nhỏ. Route admin không nằm trong `DefaultLayout`,
  nên không có khung chatbot hay thanh điều hướng của khách.

### Bảng món kiểu kiosk

Trang chủ chính là trang thực đơn (`/`), khớp Bảng 2.22 gộp "Trang chủ / Thực đơn" làm một
màn hình:

- Rail danh mục cố định bên trái ở màn hình rộng, đổi thành dải chip cuộn ngang ở màn hình nhỏ.
- Lọc khoảng giá bằng 5 dải giá dạng sẵn (dễ chạm hơn hai ô nhập số). Dải này **dính đầu vùng
  lưới** (`sticky top-0`) thay vì nằm ở một hàng riêng phía trên, tiết kiệm nguyên chiều cao
  hàng đó mà vẫn luôn trong tầm mắt. Mục đầu ghi "Mọi giá" chứ không phải "Tất cả" vì dải
  danh mục ngay dưới đã có "Tất cả", hai chữ giống nhau cạnh nhau dễ bị hiểu là một bộ lọc.
- Lưới thẻ món cuộn trong vùng riêng, phân trang 12 món mỗi trang. Số cột đổi theo bề rộng
  (`grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`); `lg` phải bớt
  cột lại vì mức đó mới xuất hiện rail.
- Thanh giỏ ghim đáy hiện khi giỏ có món, chứa tổng tiền và nút "Xem giỏ và đặt món".
- Toàn bộ bộ lọc nằm trên URL (`category`, `keyword`, `min`, `max`) nên người dùng chia sẻ
  được đường dẫn đã lọc và ô tìm kiếm trên thanh điều hướng điều khiển được trang này.

Thẻ món được nén để nhìn thấy được nhiều món hơn trên một màn hình: ảnh cắt theo 16:10 (thay
4:3), đệm `p-3`, tối đa 2 nhãn, chữ giá `text-lg`. Hàng giá và nút dùng `flex-wrap` nên thẻ hẹp
sẽ xuống dòng thay vì tràn. Đo ở cửa sổ 848×670: chiều cao thẻ 444px xuống 285px, vùng lưới
tăng từ 546px lên 614px.

`/foods/:id` là **route con** của `/` và hiển thị thành panel phủ (`Drawer`) chứ không phải
trang riêng. Nhờ vậy người dùng không rời bảng món khi xem chi tiết, URL vẫn thật để thẻ món
trong chatbot liên kết được, và nút quay lại của trình duyệt đóng được panel. URL cũ
`/foods` chuyển hướng về `/`.

### Thanh điều hướng và hệ nút

- Thanh điều hướng chỉ có đúng 4 thành phần Bảng 2.22: logo, ô tìm kiếm, giỏ hàng, đăng
  nhập, cộng ô thông báo. Không có menu điều hướng tới các trang con; những đích đó nằm trong
  menu tài khoản (Đơn hàng của tôi, Tài khoản, Trang quản trị nếu là admin, Đăng xuất).
  Header cao `3.25rem`, chỉ giữ logo nhỏ không kèm chữ tên, các nút trong header dùng
  `size="small"` (36px). Ô tìm kiếm có `md:max-w-xl`: không chặn bề rộng thì trên màn hình
  rộng nó giãng hết chỗ trống và đẩy nhóm nút bên phải lệch ra rìa.
- `components/UiButton.tsx` là nút dùng chung, chỉ 6 dạng: `primary` (44px), `primary-lg`
  (52px, đúng 1 nút mỗi màn hình), `default`, `danger`, `icon` (40px), `fab` (64px, nút mở
  chatbot). Mọi kích thước, bo góc và màu nằm ở một chỗ. Kích thước ghi bằng tiền tố `!` vì
  AntD nạp CSS-in-JS sau Tailwind và ghi đè được chiều cao của nút. Chiều cao nằm ở bảng
  `HEIGHTS` tách khỏi kiểu dáng, mỗi cỡ một ô riêng: truyền class `!h-*` để ghi đè sẽ không
  ăn vì hai class `!important` bằng nhau thì Tailwind quyết định theo thứ tự sinh CSS, muốn
  nhỏ lại phải truyền `size="small"`.
- Thẻ món dùng nút "Thêm vào giỏ" **có nhãn** vì Bảng 2.22 ghi rõ tên thành phần này; món hết
  hiện nhãn "Hết món" và nút bị vô hiệu hoá.

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

### Server (server/src/main/java/com/foodordering/)

```
FoodOrderingApplication.java   entry point
config/        cấu hình (AppProperties, DataSeeder, SecurityConfig liên quan)
security/      JwtUtil, JwtFilter
entity/        JPA entities
repository/    Spring Data JPA repositories
dto/           request/response payloads (đồng bộ thủ công với types client)
service/       nghiệp vụ chính (FoodService, OrderService, AuthService, ChatbotService,
               AiClient, KnowledgeService)
controller/    mapping và điều phối request dưới /api/...
```

### Client (client/)

```
src/
  main.tsx         bootstrap SPA, render root
  App.tsx          layout gốc và router
  api/             lớp HTTP và hàm gọi từng endpoint
  components/      component dùng chung (ChatbotWidget...)
  data/            dữ liệu tĩnh cho trang giới thiệu/marketing
  hooks/           hook xử lý request và thao tác bất đồng bộ
  layouts/         layout dùng chung cho các nhóm route
  pages/           trang theo route (auth, foods, cart, orders, admin...)
  store/           Zustand stores (authStore, cartStore)
  types/           TS interfaces phản ánh DTO backend (giữ đồng bộ thủ công)
  utils/           hàm tiện ích dùng chung
  index.css        style gốc của SPA
index.html         entry HTML
vite.config.ts     React plugin, dev server (usePolling cho Docker; không có proxy /api)
nginx.conf         prod: serve dist/ và fallback về index.html
```

## Điểm quan trọng khi làm việc

- **Không dùng Flyway**: `spring.jpa.hibernate.ddl-auto=update` để Hibernate tự tạo/cập nhật bảng. Dữ liệu mẫu nạp qua `config/DataSeeder` (`CommandLineRunner`); **seed chỉ chạy khi bảng `users` còn trống** (`if (userRepo.count() > 0) return;`), nên lần khởi động sau sẽ bỏ qua toàn bộ seed và không nhân đôi dữ liệu demo.
- **Sao lưu database**: service `db-backup` trong compose chạy `pg_dump` lúc 2h sáng vào volume `db_backup`, giữ lại 7 bản gần nhất. Khôi phục bằng `pg_restore -d food_ordering /backups/db-YYYYMMDD.dump`.
- **Giá luôn lấy từ DB**: `OrderService.create` set `price` = giá trong DB, không tin client.
- **Đồng bộ types**: `client/src/types/index.ts` phải song song với DTO server. Sửa DTO nhớ cập nhật cả hai phía.
- **AI gọi một nơi duy nhất**: `service/AiClient` là lớp DUY NHẤT gọi Gemini API (REST bằng `RestClient`, `jsonMode` ép JSON, config qua `app.ai.api-key` / `app.ai.model`). Muốn đổi nhà cung cấp AI chỉ sửa file này.
- **Ảnh món**: seed dùng ảnh demo cục bộ trong `client/public/images` (đường dẫn tương đối, resolve ở client origin), toàn bộ là `.webp` đã resize theo ô hiển thị. Admin có thể nhập link ảnh ngoài trong form quản lý; không có endpoint upload ảnh món.
- **`JwtFilter` nuốt exception** token không hợp lệ (coi như chưa đăng nhập) - đừng log token.
- **Comment và tài liệu**: comment tiếng Việt nên giải thích ràng buộc, nguồn dữ liệu, vòng đời state hoặc fallback; không lặp lại cú pháp. Khi đổi hợp đồng API hoặc quy tắc domain, cập nhật đồng bộ tài liệu kiến trúc và test.
- **Thanh giỏ cố định đáy**: `/foods` (khi giỏ có món), `/foods/:id` và `/cart` đều có thanh `fixed bottom-0`. Mọi trang đó phải chừa padding đáy, và mọi nút nổi (`ChatbotWidget`, `ScrollTopButton`) phải hỏi `useHasCartBar()` để nhảy lên cao hơn thanh. Thêm trang mới có thanh cố định thì cập nhật hook này.
- **Trang Thực đơn có hai chế độ hiển thị**: `FoodsPage` nhóm món theo danh mục (`groupByCategory`) rồi render `FoodRow` hoặc `FoodCard` tuỳ `view`. Mặc định lưới ở `lg` trở lên, hàng dọc ở mọi cỡ nhỏ hơn; lựa chọn không được lưu.

## Phát triển local (profile dev)

```bash
docker compose --profile dev up --build
```

Stack gồm postgres, server-dev và client-dev. Client truy cập tại http://localhost:5173; request API dùng `VITE_API_URL` (mặc định http://localhost:8080/api), không có Vite proxy trong cấu hình hiện tại.

- **server-dev**: mount `./server:/app`, hot reload qua `spring-boot-devtools` (restart khi file `.class` đổi). Trong container chỉ mount mã nguồn nên cần tự biên dịch: chạy `docker compose --profile dev exec server-dev sh -c "while true; do mvn -q compile; sleep 3; done"` ở terminal riêng (hoặc để IDE biên dịch vào `server/target/classes`).
- **client-dev**: mount `./client:/app` (volume ngăn chặn `node_modules`), Vite HMR với `usePolling` - cập nhật ngay khi lưu file. Chỉ cần build lại image khi đổi `package.json` hoặc `Dockerfile`.
- Cache Maven dùng volume `maven_cache` chung.

## Môi trường và cấu hình

Mọi bí mật nằm trong một file `.env` duy nhất ở root (được docker-compose.yml và server đọc). Server đọc env với fallback mặc định dev (`${VAR:default}` trong application.yml). Lưu ý `mvn spring-boot:run` **không tự nạp `.env`** - phải export vars hoặc chạy qua compose.

| Var                 | Ý nghĩa                                      |
| ------------------- | -------------------------------------------- |
| DB_NAME             | tên database Postgres                        |
| DB_USER             | user Postgres                                |
| DB_PASSWORD         | mật khẩu Postgres                            |
| DB_URL              | JDBC URL kết nối (fallback `jdbc:postgresql://localhost:5432/food_ordering`) |
| JWT_SECRET          | chuỗi bí mật ký token (≥32 ký tự)            |
| JWT_EXPIRATION_MS   | thời gian sống token (mặc định 86400000)     |
| AI_API_KEY          | API key dịch vụ AI (Gemini hoặc OpenAI)     |
| AI_PROVIDER         | nhà cung cấp mặc định (gemini)              |
| AI_MODEL            | model mặc định (gemini-2.0-flash)           |
| UPLOAD_DIR          | thư mục lưu ảnh admin tải lên (compose đặt `/app/uploads`) |

Biến chỉ dùng trong docker-compose.yml:

| Var              | Ý nghĩa                                                            |
| ---------------- | ------------------------------------------------------------------ |
| VITE_API_URL     | base URL API cho client (mặc định http://localhost:8080/api)          |

`VITE_API_URL` không phải secret. Ở profile `dev`, biến này được truyền vào container client; ở profile `prod`, nó được đưa vào lúc build Docker nên thay đổi cần rebuild image client.

Chạy toàn bộ stack: `docker compose --profile prod up --build` (production, client ở cổng 80) hoặc `docker compose --profile dev up --build` (hot reload, client ở cổng 5173). `docker compose up` (không kèm profile) chỉ khởi động Postgres.