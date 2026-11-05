# TEST.md — Kế hoạch và Tài liệu Kiểm thử FoodOrdering

Tài liệu này được cơ cấu thành hai phần trọng tâm phục vụ đánh giá chất lượng toàn diện của hệ thống FoodOrdering:
1. **Phần 1: Kiểm thử thủ công (Manual Testing)** — Kế hoạch kiểm thử, ma trận kịch bản kiểm thử chức năng theo Use Case và kiểm chứng các ràng buộc biên.
2. **Phần 2: Kiểm thử tự động (Automated Testing)** — Unit test phía Server (Spring Boot / JUnit 5 + Mockito) và E2E test phía Client (Playwright).

---

# Phần 1. Kiểm thử thủ công (Manual Testing)

## 1.1. Kế hoạch và mục tiêu kiểm thử

### Mục tiêu kiểm thử
- **MT1 — Đầy đủ chức năng:** Đảm bảo toàn bộ luồng nghiệp vụ hoạt động trơn tru theo đặc tả (xác thực, thực đơn, giỏ hàng, tính giá khuyến mãi tự động, thanh toán mô phỏng, đơn hàng, quản trị món/danh mục/khách hàng/báo cáo).
- **MT2 — Toàn vẹn dữ liệu & Ràng buộc biên:** Dữ liệu tính toán từ server luôn chính xác (giá lấy từ DB, không tin client; tổng tiền voucher không âm; chuyển đổi trạng thái đơn 1 chiều).
- **MT3 — Chatbot an toàn & tin cậy:** Chatbot AI tư vấn chuẩn xác từ thực đơn thật, **tuyệt đối không bịa món, bịa giá, hay bịa trạng thái phục vụ**; chuyển nhánh dự phòng (fallback) mượt mà khi AI timeout hoặc API key lỗi.
- **MT4 — Phân quyền & Bảo mật:** Kiểm soát quyền hạn chặt chẽ ở cấp API backend (`SecurityConfig`), không phụ thuộc việc ẩn/hiện UI. Tài khoản bị khoá mất quyền tức thời.

### Môi trường và Dữ liệu mẫu (DataSeeder)
- **Tài khoản quản trị:** `admin@demo.com` / `admin123` (vai trò `ADMIN`)
- **Tài khoản khách hàng:** `user@demo.com` / `user1234` (vai trò `CUSTOMER`)
- **Dữ liệu nạp sẵn:** 5 danh mục, 16 món ăn, 2 chương trình khuyến mãi tự động ("Cuối tuần mát lạnh", "Món may mắn hôm nay"), 3 đơn hàng mẫu (`COMPLETED`, `PREPARING`, `PENDING`), 2 đánh giá mẫu.

---

## 1.2. Kịch bản kiểm thử thủ công (Test Cases)

> **Quy ước:** Các cột *Kết quả thực tế* và *Đánh giá (Pass/Fail)* để trống cho kiểm thử viên ghi nhận khi thực thi.

### 1.2.1. Xác thực và Tài khoản (UC01 – UC05)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-AUTH-01 | Đăng nhập thành công | Tài khoản `user@demo.com` tồn tại | Nhập `user@demo.com` / `user1234` | Đăng nhập thành công, điều hướng về trang chủ, thanh header chuyển sang menu tài khoản | | |
| TC-AUTH-02 | Đăng nhập sai mật khẩu | Tài khoản `user@demo.com` tồn tại | Nhập `user@demo.com` / `sai_mat_khau` | HTTP 401, thông báo "Mật khẩu không đúng", không cấp token | | |
| TC-AUTH-03 | Đăng nhập email không tồn tại | — | Nhập `nonexistent@demo.com` / `user1234` | HTTP 401, thông báo "Email không tồn tại" | | |
| TC-AUTH-04 | Đăng ký thành công | Email chưa đăng ký | Nhập email mới, pass `matkhau123`, SĐT `0901234567`, họ tên | Tạo tài khoản thành công, tự động tặng voucher `WELCOME` vào ví, cấp token | | |
| TC-AUTH-05 | Đăng ký trùng email | Đã có `user@demo.com` | Đăng ký với email `user@demo.com` | HTTP 400, thông báo lỗi email đã tồn tại | | |
| TC-AUTH-06 | Đăng ký mật khẩu < 8 ký tự | — | Nhập mật khẩu `1234567` (7 ký tự) | Báo lỗi validation phía client và backend HTTP 400 | | |
| TC-AUTH-07 | Đăng ký SĐT không hợp lệ | — | Nhập SĐT `12345` hoặc `01234567891` | Báo lỗi SĐT phải đúng định dạng 10 chữ số (bắt đầu bằng 0) | | |
| TC-AUTH-08 | Đăng nhập tài khoản bị khoá | Admin đã khoá `user@demo.com` | Đăng nhập bằng `user@demo.com` / `user1234` | HTTP 403, thông báo "Tài khoản đã bị khóa" | | |
| TC-AUTH-09 | Cập nhật hồ sơ cá nhân | Đã đăng nhập | Vào `/profile`, sửa họ tên, SĐT, địa chỉ mặc định | HTTP 200, thông tin được cập nhật chính xác vào CSDL | | |
| TC-AUTH-10 | Đổi mật khẩu hợp lệ | Đã đăng nhập | Nhập mật khẩu hiện tại đúng và mật khẩu mới ≥ 8 ký tự | HTTP 200, mật khẩu mới có hiệu lực ngay | | |
| TC-AUTH-11 | Đổi mật khẩu với pass cũ sai | Đã đăng nhập | Nhập mật khẩu cũ sai | HTTP 400, thông báo "Mật khẩu hiện tại không đúng", giữ nguyên pass cũ | | |
| TC-AUTH-12 | Đăng xuất | Đã đăng nhập | Nhấn nút "Đăng xuất" trên menu | Xoá token khỏi storage, giỏ hàng về rỗng (không còn giỏ local), bảo vệ các route yêu cầu đăng nhập | | |
| TC-AUTH-13 | Khách mở giỏ khi chưa đăng nhập | Chưa đăng nhập | Bấm nút giỏ trên header hoặc mở thẳng `/cart` | Chuyển sang `/login`; sau khi đăng nhập quay lại đúng `/cart` | | |

### 1.2.2. Khám phá Thực đơn, Combo & Tìm kiếm (UC06 – UC08)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-MENU-01 | Xem danh sách món & Phân trang | Trang chủ `/` | Cuộn danh sách món | Hiển thị dạng lưới thẻ món (12 món/trang, 2 cột trên mobile, 4 cột từ 768px), kèm nhãn giá, tag ăn kiêng, độ cay | | |
| TC-MENU-02 | Lọc theo danh mục | Trang chủ `/` | Bấm chọn danh mục "Món Việt" | URL cập nhật `?category=Mon+Viet`, chỉ hiển thị các món thuộc danh mục đã chọn | | |
| TC-MENU-03 | Tìm kiếm theo từ khóa & Giá | Trang chủ `/` | Nhập từ khóa "bún", lọc khoảng giá 50.000đ - 100.000đ | Lưới món lọc đúng các món chứa từ khóa trong tên và nằm trong khoảng giá | | |
| TC-MENU-05 | Tìm không dấu & không phân biệt hoa thường | Trang chủ `/` | Gõ "pho bo", "ca phe", "do uong" vào ô tìm kiếm | Lần lượt ra "Phở bò", "Cà phê sữa đá", các món Đồ uống; server lọc qua `TextNormalizer` (không cần PostgreSQL `unaccent`) | | |
| TC-MENU-07 | Enter giữ bộ lọc hiện tại | Đang lọc theo danh mục + khoảng giá trên `/` | Gõ từ khóa mới rồi nhấn Enter | URL giữ nguyên `category`/`min`/`max` và cập nhật `keyword` tức thì (không đợi debounce), lưới món lọc theo cả bộ lọc cũ + từ khóa mới | | |
| TC-MENU-08 | Enter khi đang ở trang khác | Đang ở `/orders` hoặc `/cart` | Gõ từ khóa trong ô tìm kiếm rồi nhấn Enter | Quay về `/` kèm `?keyword=...`; không mất dữ liệu trang đang xem khi dùng nút Quay lại | | |
| TC-MENU-09 | Bố cục lưới và thanh lọc theo bề rộng | Trang chủ `/` | Thu hẹp/phóng cửa sổ lần lượt 360px, 768px, 1024px, 1280px rồi cuộn lưới món | 360px: 2 cột, chip giá xuống dòng, không có thanh cuộn ngang; từ 768px: 4 cột, chip danh mục và dải giá nằm cùng một hàng, thanh lọc vẫn dính khi cuộn | | |
| TC-MENU-04 | Xem chi tiết món ăn | Có món "Phở bò" | Bấm vào thẻ "Phở bò" | Mở Drawer chi tiết món (`/foods/:id`), hiện mô tả, thành phần, cảnh báo dị ứng, đánh giá sao | | |
| TC-MENU-06 | Món ngừng phục vụ | Món có `available = false` | Xem món trên thực đơn | Thẻ món hiển thị nhãn "Hết món", nút "Thêm vào giỏ" bị vô hiệu hoá | | |

### 1.2.3. Giỏ hàng & Định giá Khuyến mãi (UC09 – UC12, PricingService)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-CART-01 | Thêm món vào giỏ | Đã đăng nhập, món còn phục vụ | Bấm "Thêm vào giỏ" món Phở bò | Giỏ tăng 1, thanh Bottom Cart Bar hiển thị tổng tiền cập nhật đúng | | |
| TC-CART-02 | Tăng số lượng món trùng | Đã đăng nhập, giỏ đã có Phở bò (1) | Bấm thêm Phở bò lần nữa | Giỏ cập nhật dòng Phở bò thành số lượng 2 (không tạo dòng trùng lặp) | | |
| TC-CART-04 | Cập nhật số lượng / Xoá dòng | Đã đăng nhập, giỏ có món | Tăng/giảm số lượng hoặc bấm xoá dòng | Tổng tiền cập nhật theo báo giá mới nhất sau khi server trả lời; không nhấp nháy số của giỏ trước, nút xác nhận bị khoá trong lúc "Đang cập nhật giá..." | | |
| TC-CART-05 | Khuyến mãi tự động (Auto-promo) | Đã đăng nhập, thứ Bảy/Chủ Nhật, có CT "Cuối tuần mát lạnh" (-20% đồ uống) | Thêm 1 đồ uống và 1 món ăn vào giỏ | Đồ uống được giảm 20%, món ăn giữ nguyên giá; chiết khấu hiển thị theo dòng | | |
| TC-CART-06 | Khách chưa đăng nhập không thêm được món | Chưa đăng nhập | Hover/focus (Tab) nút "Thêm vào giỏ" rồi bấm | Nút mờ kèm tooltip "Đăng nhập để thêm món vào giỏ"; bấm không thêm món và không mở chi tiết món; giỏ header vẫn 0 | | |
| TC-CART-07 | Món hết khi chưa đăng nhập | Chưa đăng nhập, món có `available = false` | Xem thẻ món | Nút hiện "Hết món", bị vô hiệu hoá và **không** có tooltip đăng nhập | | |
| TC-CART-08 | Báo giá khớp giỏ khi thêm từ chatbot | Đã đăng nhập, giỏ có 1 món có khuyến mãi | Mở chatbot, thêm món thứ hai bằng nút giỏ trên thẻ món, rồi tăng/giảm số lượng liên tục | Không có dòng "Hết món" giả; thành tiền từng dòng, tổng giảm và tổng thanh toán khớp báo giá mới nhất; request quote cũ bị abort, không ghi đè số mới | | |

### 1.2.4. Đặt hàng & Vòng đời Đơn hàng (UC12 – UC16, UC30 – UC31)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-ORD-01 | Đặt hàng COD thành công | Giỏ có món hợp lệ | Điền tên, SĐT, địa chỉ, chọn COD, bấm đặt | Tạo đơn `status = PENDING`, `paymentStatus = UNPAID`, giỏ được dọn sạch, chuyển sang `/orders` | | |
| TC-ORD-02 | Đặt hàng phương thức QR | Giỏ có món hợp lệ | Chọn phương thức QR, hoàn tất đặt | Tạo đơn với `payment_method = QR`, hiển thị mã QR mô phỏng chuẩn `FOOD-{id}-{total}` | | |
| TC-ORD-03 | Giá luôn lấy từ DB | Khách gửi request API sửa đổi giá món = 1đ | Gọi `POST /api/orders` với payload can thiệp | Server tính lại toàn bộ theo giá CSDL, bỏ qua giá client gửi lên | | |
| TC-ORD-04 | Chặn đặt món đã hết | Có món vừa chuyển `available = false` | Gửi request đặt đơn có món này | HTTP 400, thông báo món đã ngừng phục vụ, huỷ toàn bộ transaction đặt hàng | | |
| TC-ORD-05 | Khách thanh toán đơn QR | Có đơn QR `PENDING` + `UNPAID` | Bấm "Thanh toán", xác nhận | Đơn chuyển sang `PAID`, sinh thời gian `paidAt`, gửi thông báo cho khách | | |
| TC-ORD-06 | Khách tự huỷ đơn hợp lệ | Đơn `PENDING` **và** `UNPAID` | Bấm "Huỷ đơn" trong `/orders` | HTTP 200, đơn chuyển thành `CANCELLED`, gửi thông báo huỷ đơn | | |
| TC-ORD-07 | Chặn huỷ đơn đã thanh toán | Đơn `PENDING` nhưng đã `PAID` | Cố gắng huỷ đơn | HTTP 400, không cho phép khách tự huỷ đơn đã thu tiền | | |
| TC-ORD-08 | Chặn huỷ đơn đã xác nhận/đang vận chuyển | Đơn `CONFIRMED` hoặc `PREPARING` | Cố gắng huỷ đơn | HTTP 400, không cho phép khách huỷ khi quán đã tiếp nhận/đang vận chuyển | | |
| TC-ORD-09 | Đặt lại đơn hàng cũ | Đơn cũ `COMPLETED` | Bấm nút "Đặt lại" | Tự động thêm các món còn bán vào giỏ, loại bỏ món ngừng phục vụ, không mang theo ghi chú cũ | | |
| TC-ORD-10 | Bảo mật dữ liệu đơn hàng | Có 2 tài khoản khách A và B | Khách B cố truy vấn đơn hàng của khách A | API chặn trả về dữ liệu (chỉ xem được đơn của chính mình) | | |
| TC-ORD-11 | Nút Huỷ đơn chỉ ở đơn hợp lệ | Đơn `CONFIRMED` hoặc `PREPARING` | Mở `/orders` và xem thẻ đơn | Không hiển thị nút "Huỷ đơn" (điều kiện theo `canCancelOrder`), server vẫn chặn nếu gọi thẳng API | | |
| TC-ORD-12 | PENDING đã thanh toán hướng hotline | Đơn `PENDING` + `PAID` | Mở `/orders` và xem thẻ đơn | Không có nút "Huỷ đơn", hiện gợi ý gọi hotline 0246.888.9999 để hủy/hoàn tiền | | |
| TC-ORD-13 | Nhãn Đang vận chuyển | Đơn `PREPARING` | Xem danh sách đơn ở `/orders`, Steps, trang admin và thông báo | Nhãn/Thông báo ghi "Đang vận chuyển" (không còn "Đang chế biến"); nút admin từ `CONFIRMED` ghi "Giao hàng" | | |
| TC-ORD-14 | Nút Đặt lại chỉ ở đơn giao xong | Đơn `PENDING`/`CONFIRMED`/`PREPARING` | Mở `/orders` và xem thẻ đơn | Không hiển thị nút "Đặt lại"; đơn `COMPLETED` vẫn có nút | | |

### 1.2.5. Chatbot Tư vấn Món ăn AI & Nhánh Dự phòng (UC21 – UC25)

| Mã TC | Tình huống | Dữ liệu đầu vào (Câu hỏi) | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|------------|----------------------------|-------------------|------------------|-----------|
| TC-BOT-01 | Tư vấn theo khẩu vị & dị ứng | "Tôi muốn ăn món Việt, không cay và không có hải sản" | Gợi ý món có `spicyLevel = 0`, danh mục Món Việt, không chứa hải sản trong dị ứng/thành phần | | |
| TC-BOT-02 | Tư vấn theo số người & ngân sách | "Gợi ý món ăn cho 4 người trong tầm giá 200.000đ" | Tính `portions = ceil(4 / servingSize)` cho từng món; `totalPrice = gia * portions`; **tổng `totalPrice` của toàn bộ thẻ ≤ 200.000đ**, không chỉ từng món | | |
| TC-BOT-03 | Kết hợp món ăn & đồ uống | "Cho tôi một món chính và một món uống dưới 100k" | Trả về đúng 2 thẻ: 1 món chính và 1 đồ uống, tổng tiền 2 món ≤ 100.000đ | | |
| TC-BOT-04 | Món ăn theo chế độ ăn kiêng | "Có món chay nào ngon không?" | Chỉ gợi ý các món có nhãn "chay" trong `dietaryTags`, không gợi ý món thịt | | |
| TC-BOT-05 | Câu hỏi ngoài lề (Out of scope) | "Thời tiết hôm nay thế nào?" / "Viết code Java giúp tôi" | Từ chối lịch sự, nhắc nhở phạm vi tư vấn món ăn, **tuyệt đối không gợi ý thẻ món nào** | | |
| TC-BOT-06 | Kiểm tra tính trung thực của món | "Cho tôi món Pizza sầu riêng / Món ngoài thực đơn" | Không gợi ý món bịa; giải thích quán không phục vụ món này | | |
| TC-BOT-07 | Không gợi ý món đã ngừng bán | Một món vừa bị tắt `available = false` | Món ngừng bán không bao giờ xuất hiện trong danh sách thẻ gợi ý | | |
| TC-BOT-08 | Khách vãng lai chưa đăng nhập | Đặt câu hỏi tư vấn tại trang chủ | Chatbot trả lời và hiện thẻ món bình thường nhưng **không** lưu lại phiên vào CSDL lịch sử | | |
| TC-BOT-09 | Lưu lịch sử khi đã đăng nhập | Khách đã đăng nhập chat | Nội dung hội thoại được lưu vào bảng `chat_messages`, xem được tại trang admin | | |
| TC-BOT-10 | Nhánh dự phòng (Fallback - Sai API Key) | Khoá AI bị sai/hỏng/hết hạn, hỏi "Món chay không cay" | Server chuyển sang `selectFoodsByCode()`, trả lời tóm tắt 1 dòng + hiển thị đúng thẻ món chay không cay từ DB, không có banner notice | | |
| TC-BOT-11 | Thiếu khóa API | `.env` không có `AI_API_KEY` (rỗng), hỏi "Món chay không cay" | Không gọi mạng tới AI; banner hổ phách "Trợ lý AI chưa được cấu hình khóa API..." hiện đầu khung chat; chatbot vẫn trả thẻ món dự phòng từ DB | | |
| TC-BOT-12 | Chỉ giữ thẻ của lượt mới nhất | Hỏi 3 câu liên tiếp, mỗi câu đều có gợi ý món | Khung chat chỉ còn tối đa 5 thẻ ở tin bot mới nhất; tin bot cũ vẫn giữ chữ nhưng không còn thẻ; không còn nút "Xem thực đơn" | | |
| TC-BOT-13 | Ngân sách là tổng bộ gợi ý | Hỏi "Bữa tối 200k cho 2 người" | Tổng `totalPrice` của tất cả thẻ ≤ 200.000đ; cấu hình `max_suggestions` cũ 8/10 vẫn chỉ trả tối đa 5 thẻ | | |
| TC-BOT-14 | Hỏi tiếp theo ngữ cảnh | Sau lượt gợi ý món, hỏi "Món đó cay không?" | Server dùng `lastFoodIds`, chỉ trả món trong nhóm vừa gợi ý đã áp ràng buộc cay; không quét sang món ngoài ngữ cảnh | | |
| TC-BOT-15 | Chủ đề mới không dính ngữ cảnh cũ | Sau lượt gợi ý món mặn, hỏi "Món đó có món chay không?" | Bỏ qua `lastFoodIds`, tìm trên toàn thực đơn; chỉ trả món có nhãn "chay" | | |
| TC-BOT-16 | Khách vãng lai thêm món từ thẻ chatbot | Chưa đăng nhập, mở chatbot có thẻ món | Nút thêm vào giỏ bị disabled kèm tooltip "Đăng nhập để thêm món vào giỏ"; bấm vào không thêm món và không điều hướng sang chi tiết món | | |

| TC-BOT-11 | Lưu lịch sử khách vãng lai | Khách chưa đăng nhập gửi 2 câu hỏi liên tiếp | Câu hỏi thứ hai được lưu vào `chat_message` với `user = null` theo `sessionId`; ngữ cảnh phiên được dùng cho lượt trả lời | | |
| TC-BOT-12 | Giải quyết đại từ tham chiếu | Sau khi gợi ý món, hỏi "món đó rẻ hơn được không?" | Server dùng tên món vừa gợi ý để trích tiêu chí; kết quả lọc dựa trên các món đó, không trả về danh sách không liên quan | | |
| TC-BOT-13 | Validate tiêu chí | AI trích xuất `keywords` quá chắt không khớp món nào | Server bỏ lọc từ khóa, vẫn giữ ràng buộc thuộc tính (cay, dị ứng, nhãn); không trả danh sách rỗng vô lý | | |

### 1.2.6. Quản trị hệ thống (Admin Portal: UC26 - UC35)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-ADM-01 | Phân quyền truy cập | Đăng nhập tài khoản khách thường | Cố truy cập `/admin/*` hoặc gọi API `/api/admin/**` | Bị chặn chuyển hướng hoặc nhận HTTP 403 Forbidden | | |
| TC-ADM-02 | Quản lý Món ăn (CRUD) | Đăng nhập Admin | Thêm mới món với đầy đủ ảnh, giá, khẩu phần, nhãn dị ứng | HTTP 200, món mới xuất hiện ngay trên thực đơn | | |
| TC-ADM-03 | Chặn xoá món đã có trong đơn | Món đã từng phát sinh đơn hàng | Nhấn "Xoá món" | HTTP 409 Conflict, từ chối xoá và hướng dẫn chuyển sang ngừng phục vụ | | |
| TC-ADM-04 | Chặn tải ảnh không hợp lệ | Đang ở form thêm/sửa món | Tải file `.txt` đổi đuôi thành `.png` hoặc file > 2MB | Bị chặn do kiểm tra Magic Bytes (chữ ký nhị phân) và dung lượng | | |
| TC-ADM-05 | Chuyển trạng thái đơn 1 chiều | Đơn đang ở `PENDING` | Chuyển `PENDING -> CONFIRMED -> PREPARING -> COMPLETED` | Trạng thái chuyển thành công tuần tự; cố nhảy cóc bị trả lỗi HTTP 400 | | |
| TC-ADM-06 | Khoá / Mở khoá khách hàng | Khách hàng vi phạm | Nhấn nút khoá tài khoản khách | Khách bị khoá không thể đăng nhập, token hiện tại bị vô hiệu hoá | | |
| TC-ADM-07 | Bảo vệ tài khoản Quản trị | Tài khoản mục tiêu là `ADMIN` | Cố gắng khoá hoặc xoá admin khác | HTTP 400, hệ thống từ chối thao tác trên tài khoản quản trị | | |
| TC-ADM-08 | Quản lý khuyến mãi tự động | Đăng nhập Admin | Tạo/sửa chương trình khuyến mãi tự động | CSDL cập nhật, áp dụng chuẩn xác ngay trong các lượt tính giá tiếp theo | | |
| TC-ADM-09 | Báo cáo doanh thu & Xuất file | Đăng nhập Admin | Vào `/admin/reports`, chọn khoảng ngày và bấm "Xuất Excel" | Tải về file `.xlsx` thống kê đúng doanh thu, số đơn và top món bán chạy | | |

### 1.2.7. Đánh giá và Thông báo

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-REVIEW-01 | Đánh giá chỉ bằng số sao | Đã đăng nhập, có đơn `COMPLETED` chứa món | Chọn 5 sao, để trống nội dung, bấm "Gửi đánh giá" | Gửi thành công, thẻ đánh giá hiện 5 sao và không có dòng nhận xét | | |
| TC-REVIEW-02 | Sửa đánh giá xóa hết nội dung | Đã có đánh giá kèm nội dung | Bấm "Sửa", xóa trắng ô nhận xét, bấm "Lưu thay đổi" | Cập nhật thành công, CSDL lưu `comment = null`, giao diện không hiện dòng nhận xét | | |
| TC-REVIEW-03 | Nội dung chỉ có khoảng trắng | Đã đăng nhập, có đơn `COMPLETED` chứa món | Gửi đánh giá với nội dung chỉ gồm dấu cách | Server chuẩn hóa thành `null`, đánh giá vẫn được lưu | | |
| TC-REVIEW-04 | Chặn đánh giá món chưa mua | Đã đăng nhập, chưa có đơn `COMPLETED` chứa món | Gửi đánh giá cho món đó | HTTP 403, không tạo đánh giá (giữ nguyên ràng buộc cũ) | | |
| TC-NOTIFY-01 | Mở đơn từ thông báo | Có thông báo gắn đơn, đang đăng nhập | Bấm vào thân thông báo | Popover đóng, chuyển tới `/orders?orderId={id}`, đúng thẻ đơn được cuộn tới và tô ring, thông báo chuyển đã đọc, badge giảm 1 | | |
| TC-NOTIFY-02 | Thông báo cũ không có `orderId` | Thông báo tạo trước khi thêm `orderId` | Bấm vào thân thông báo | Thông báo chuyển đã đọc, popover đóng, không điều hướng | | |
| TC-NOTIFY-03 | Xóa thông báo đã đọc | Có cả thông báo đã đọc và chưa đọc | Bấm "Xóa đã đọc" | Chỉ các thông báo `read = true` biến mất, thông báo chưa đọc còn nguyên | | |
| TC-NOTIFY-04 | Xóa một thông báo | Có ít nhất một thông báo | Trên desktop hover thông báo, trên mobile xem trực tiếp, bấm nút xóa | Nút xóa hiện đúng trên cả hai cỡ màn hình, xóa đúng thông báo, không mở đơn hay đóng popover | | |
| TC-NOTIFY-05 | Chặn thao tác thông báo người khác | Có 2 tài khoản khách A và B | Dùng token của B gọi `POST /api/notifications/{id}/read` hoặc `DELETE` thông báo của A | HTTP 403, thông báo của A không đổi | | |
| TC-NOTIFY-06 | `orderId` không còn tồn tại | Thông báo trỏ tới đơn đã bị xóa | Bấm vào thân thông báo | Vẫn đánh dấu đã đọc và mở `/orders`, trang không lỗi và bỏ qua việc cuộn | | |

---

# Phần 2. Kiểm thử tự động (Automated Testing)

## 2.1. Kiểm thử Unit Test phía Server (Spring Boot / JUnit 5 + Mockito)

Kiểm thử tự động backend tập trung vào việc bảo vệ các thuật toán lõi và nghiệp vụ biên phức tạp mà không phụ thuộc vào hạ tầng bên ngoài (chạy độc lập, không cần Docker/DB):
- **ChatbotServiceTest:** Kiểm chứng việc áp tiêu chí lọc món xác định bằng code Java, đảm bảo AI không bịa món/giá, và kiểm tra cơ chế fallback.
- **PricingServiceTest:** Kiểm chứng quy tắc giảm giá tự động theo từng dòng, chọn chương trình tốt nhất và chặn giảm giá vượt tổng tiền.
- **OrderDtosValidationTest:** Kiểm chứng ràng buộc biên DTO đầu vào của đơn hàng (whitelist phương thức thanh toán, độ dài ghi chú, giỏ rỗng).

### 2.1.1. Lệnh thực thi kiểm thử Server

```bash
# Di chuyển vào thư mục server
cd server

# Chạy toàn bộ test suite backend
mvn test

# Chạy riêng từng lớp kiểm thử nghiệp vụ
mvn test -Dtest=ChatbotServiceTest
mvn test -Dtest=PricingServiceTest
mvn test -Dtest=OrderDtosValidationTest
```

### 2.1.2. Mã nguồn Unit Test tham chiếu chuẩn xác

#### A. ChatbotServiceTest (`server/src/test/java/com/foodordering/service/ChatbotServiceTest.java`)
```java
package com.foodordering.service;

import com.foodordering.dto.ChatbotDtos.ChatRequest;
import com.foodordering.dto.ChatbotDtos.ChatResponse;
import com.foodordering.dto.ChatbotDtos.FoodCard;
import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.repository.AiSettingRepository;
import com.foodordering.repository.CategoryRepository;
import com.foodordering.repository.ChatMessageRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm chứng bộ lọc của chatbot: tiêu chí do AI trích xuất phải được áp bằng code xác định,
 * không phải bằng suy luận của AI. Test ở mức service nên chạy nhanh, không cần database.
 */
class ChatbotServiceTest {

    private AiClient ai;
    private FoodRepository foodRepo;
    private CategoryRepository categoryRepo;
    private ChatbotService service;

    private Category monChinh;
    private Category doUong;

    @BeforeEach
    void setUp() {
        ai = mock(AiClient.class);
        foodRepo = mock(FoodRepository.class);
        categoryRepo = mock(CategoryRepository.class);
        ChatMessageRepository chatRepo = mock(ChatMessageRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        AiSettingRepository settingRepo = mock(AiSettingRepository.class);

        monChinh = new Category();
        monChinh.setId(1L);
        monChinh.setName("Món Việt");
        doUong = new Category();
        doUong.setId(2L);
        doUong.setName("Đồ uống");

        when(categoryRepo.findAll()).thenReturn(List.of(monChinh, doUong));
        when(foodRepo.findAll()).thenAnswer(inv -> thucDong());
        when(settingRepo.findById(anyString())).thenReturn(Optional.empty());

        service = new ChatbotService(ai, foodRepo, categoryRepo, chatRepo, userRepo, settingRepo);
    }

    @Test
    @DisplayName("Tư vấn theo số người: số phần tính theo khẩu phần, tổng tiền nằm trong ngân sách")
    void tuVanTheoSoNguoi() {
        mockExtract("""
                {"categories":[{"name":"Món Việt","count":1}],
                 "maxSpicyLevel":null,"maxBudget":200000,"people":2,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món ngon dưới 200k cho 2 người", "s1"));

        assertThat(res.foods()).isNotEmpty();
        FoodCard pho = res.foods().stream().filter(c -> c.name().equals("Phở bò")).findFirst().orElseThrow();
        assertThat(pho.portions()).isEqualTo(2);
        assertThat(pho.totalPrice()).isEqualTo("130000");
        assertThat(res.foods()).allSatisfy(c -> {
            assertThat(Long.parseLong(c.totalPrice())).isLessThanOrEqualTo(200000L);
            assertThat(c.portions()).isGreaterThanOrEqualTo(1);
        });
    }

    @Test
    @DisplayName("Tư vấn kết hợp món: mỗi loại một món và tổng tiền không vượt ngân sách")
    void tuVanKetHopMon() {
        mockExtract("""
                {"categories":[{"name":"Món Việt","count":1},{"name":"Đồ uống","count":1}],
                 "maxSpicyLevel":null,"maxBudget":150000,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("1 món chính và 1 món uống khoảng 150k", "s2"));

        assertThat(res.foods()).hasSize(2);
        long tong = res.foods().stream().mapToLong(c -> Long.parseLong(c.totalPrice())).sum();
        assertThat(tong).isLessThanOrEqualTo(150000L);
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.categoryName()).isEqualTo("Món Việt"));
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.categoryName()).isEqualTo("Đồ uống"));
    }

    @Test
    @DisplayName("Tư vấn theo khẩu vị: chỉ món không cay, loại trừ thành phần khách dị ứng")
    void tuVanTheoKhauVi() {
        mockExtract("""
                {"categories":[],"maxSpicyLevel":0,"maxBudget":null,"people":null,
                 "excludeAllergens":["hải sản"],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món nào không cay và không có hải sản?", "s3"));

        assertThat(res.foods()).isNotEmpty();
        assertThat(res.foods()).allSatisfy(c -> {
            Food f = thucDong().stream().filter(x -> x.getName().equals(c.name())).findFirst().orElseThrow();
            assertThat(f.getSpicyLevel()).isZero();
            assertThat((f.getAllergens() + " " + f.getIngredients()).toLowerCase())
                    .doesNotContain("hải sản");
        });
    }

    @Test
    @DisplayName("AI lỗi thì rơi sang nhánh dự phòng: món gợi ý lấy từ CSDL chứ không do AI bịa")
    void aiLoiRoiSangNhanhDungPhong() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));

        ChatResponse res = service.chat(null, new ChatRequest("Gợi ý món chay không cay", "s4"));

        assertThat(res.foods()).isNotEmpty();
        assertThat(res.foods()).allSatisfy(c -> {
            Food f = thucDong().stream().filter(x -> x.getName().equals(c.name())).findFirst().orElseThrow();
            assertThat(f.getDietaryTags().toLowerCase()).contains("chay");
            assertThat(f.getSpicyLevel()).isZero();
        });
        assertThat(res.reply()).startsWith("Mình tìm được 2 món chay, không cay");
        assertThat(res.reply()).doesNotContain("Trà đào cam sả");
        assertThat(res.reply()).contains("Bấm vào thẻ món bên dưới");
    }

    @Test
    @DisplayName("AI lỗi và câu hỏi ngoài lề thì không gợi ý món nào")
    void aiLoiCauHoiNgoaiLe() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));

        ChatResponse res = service.chat(null, new ChatRequest("Ai là Tổng thống Việt Nam?", "s6"));

        assertThat(res.foods()).isEmpty();
        assertThat(res.reply()).contains("Mình chỉ tư vấn được về món ăn của quán");
    }

    @Test
    @DisplayName("AI trả thêm trường lạ thì vẫn dùng được tiêu chí đã nhận")
    void aiTraThemTruongLa() {
        mockExtract("""
                {"categories":[],"maxSpicyLevel":0,"maxBudget":null,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[],"mucDoCay":"khong","note":"abc"}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("món không cay", "s5"));

        assertThat(res.foods()).isNotEmpty();
    }

    private void mockExtract(String json) {
        when(ai.generate(anyString(), anyString(), anyBoolean()))
                .thenAnswer(inv -> inv.getArgument(2, Boolean.class) ? json : "Dưới đây là gợi ý của mình.");
    }

    private List<Food> thucDong() {
        List<Food> list = new ArrayList<>();
        list.add(mon("Phở bò", monChinh, 65000, 1, 0, "", "gluten"));
        list.add(mon("Bún chả Hà Nội", monChinh, 60000, 1, 0, "", ""));
        list.add(mon("Cơm gà xối mỡ", monChinh, 55000, 1, 0, "", ""));
        list.add(mon("Bún bò Huế", monChinh, 70000, 1, 3, "", "gluten"));
        list.add(mon("Gỏi cuốn tôm thịt", monChinh, 45000, 2, 0, "", "hải sản,đậu phộng"));
        list.add(mon("Canh chua cá lóc", monChinh, 90000, 3, 1, "ít dầu mỡ", "hải sản"));
        list.add(mon("Lẩu thái hải sản", monChinh, 250000, 4, 3, "", "hải sản"));
        list.add(mon("Bò lúc lắc", monChinh, 120000, 2, 0, "", ""));
        list.add(mon("Mỳ Ý sốt bò băm", monChinh, 85000, 1, 0, "", "gluten"));
        list.add(mon("Trà đào cam sả", doUong, 40000, 1, 0, "chay", ""));
        list.add(mon("Nước cam ép", doUong, 35000, 1, 0, "chay,ít dầu mỡ", ""));
        list.add(mon("Cà phê sữa đá", doUong, 30000, 1, 0, "", "sữa"));
        return list;
    }

    private Food mon(String ten, Category cat, long gia, int khauPhan, int cay, String nhan, String diUng) {
        Food f = new Food();
        f.setId((long) ten.hashCode());
        f.setName(ten);
        f.setCategory(cat);
        f.setPrice(BigDecimal.valueOf(gia));
        f.setServingSize(khauPhan);
        f.setSpicyLevel(cay);
        f.setDietaryTags(nhan);
        f.setAllergens(diUng);
        f.setIngredients("nguyên liệu chung");
        f.setAvailable(true);
        return f;
    }
}
```

#### B. PricingServiceTest (`server/src/test/java/com/foodordering/service/PricingServiceTest.java`)
```java
package com.foodordering.service;

import com.foodordering.dto.OrderDtos.OrderItemRequest;
import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.ComboRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.PromotionRepository;
import com.foodordering.repository.UserVoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm luật tiền của PricingService: giảm giá theo từng dòng, voucher chia đúng
 * tổng tiền và chặn mã chưa nhận.
 */
class PricingServiceTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 10, 0);
    private static final Clock CLOCK =
            Clock.fixed(NOW.atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());

    private PromotionRepository promotionRepo;
    private UserVoucherRepository userVoucherRepo;
    private FoodRepository foodRepo;
    private ComboRepository comboRepo;
    private PricingService pricing;

    private Food food;
    private Food drink;

    @BeforeEach
    void setUp() {
        promotionRepo = mock(PromotionRepository.class);
        userVoucherRepo = mock(UserVoucherRepository.class);
        foodRepo = mock(FoodRepository.class);
        comboRepo = mock(ComboRepository.class);
        PromotionService promotionService = new PromotionService(promotionRepo, userVoucherRepo);
        pricing = new PricingService(promotionService, foodRepo, comboRepo, userVoucherRepo, CLOCK);

        Category drinks = new Category();
        drinks.setId(2L);
        food = food(1L, "Cơm gà", 60000);
        drink = food(2L, "Trà đào", 20000);
        food.setCategory(category(1L));
        drink.setCategory(drinks);

        when(foodRepo.findById(1L)).thenReturn(Optional.of(food));
        when(foodRepo.findById(2L)).thenReturn(Optional.of(drink));
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of());
    }

    @Test
    void percentPromotionAppliesToEveryLine() {
        when(promotionRepo.findByActiveTrue())
                .thenReturn(List.of(promotion("Giảm 20%", null, Promotion.DiscountType.PERCENT, 20)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 2)), null, null);

        assertThat(priced.subtotal()).isEqualByComparingTo("120000");
        assertThat(priced.discountTotal()).isEqualByComparingTo("24000");
        assertThat(priced.total()).isEqualByComparingTo("96000");
        assertThat(priced.lines().get(0).lineDiscount()).isEqualByComparingTo("24000");
    }

    @Test
    void onlyBestAutomaticPromotionAppliesPerLine() {
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(
                promotion("Giảm 10%", null, Promotion.DiscountType.PERCENT, 10),
                promotion("Giảm 25%", null, Promotion.DiscountType.PERCENT, 25)));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1)), null, null);

        assertThat(priced.discountTotal()).isEqualByComparingTo("15000");
    }

    @Test
    void voucherLargerThanOrderNeverMakesTotalNegative() {
        Promotion voucher = promotion("Giảm 30k", "V30", Promotion.DiscountType.FIXED, 30000);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        Food odd = food(3L, "Chè", 10001);
        when(foodRepo.findById(3L)).thenReturn(Optional.of(odd));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(3L, null, 1)), null, "V30");

        assertThat(priced.discountTotal()).isEqualByComparingTo("10001");
        assertThat(priced.total()).isEqualByComparingTo("0");
    }

    @Test
    void fixedVoucherAllocationSumsToVoucherValue() {
        Promotion voucher = promotion("Giảm 30k", "V30", Promotion.DiscountType.FIXED, 30000);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        Food odd = food(3L, "Chè", 10001);
        when(foodRepo.findById(3L)).thenReturn(Optional.of(odd));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1), new OrderItemRequest(3L, null, 1)),
                null, "V30");

        BigDecimal allocated = priced.lines().stream()
                .map(PricingService.Line::lineDiscount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(allocated).isEqualByComparingTo("30000");
        assertThat(priced.discountTotal()).isEqualByComparingTo("30000");
        assertThat(priced.total()).isEqualByComparingTo("40001");
    }

    @Test
    void voucherBelowMinimumOrderIsRejected() {
        Promotion voucher = promotion("Giảm 20k", "WELCOME", Promotion.DiscountType.FIXED, 20000);
        voucher.setMinOrderTotal(BigDecimal.valueOf(100000));
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));

        assertThatThrownBy(() -> pricing.priceOrder(
                List.of(new OrderItemRequest(2L, null, 1)), null, "WELCOME"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tối thiểu");
    }

    @Test
    void claimableVoucherMustBeInWallet() {
        Promotion voucher = promotion("Khách mới", "WELCOME", Promotion.DiscountType.FIXED, 20000);
        voucher.setClaimable(true);
        when(promotionRepo.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(voucher));
        when(userVoucherRepo.findByUserIdAndPromotionId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1)), user(9L), "WELCOME"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("chưa nhận");
    }

    @Test
    void categoryPromotionSkipsFoodsOutsideTarget() {
        Promotion weekend = promotion("Cuối tuần", null, Promotion.DiscountType.PERCENT, 20);
        weekend.setScope(Promotion.Scope.CATEGORY);
        weekend.setTargetIds(List.of(2L));
        when(promotionRepo.findByActiveTrue()).thenReturn(List.of(weekend));

        PricingService.PricedCart priced = pricing.priceOrder(
                List.of(new OrderItemRequest(1L, null, 1), new OrderItemRequest(2L, null, 1)),
                null, null);

        assertThat(priced.lines().get(0).lineDiscount()).isEqualByComparingTo("0");
        assertThat(priced.lines().get(1).lineDiscount()).isEqualByComparingTo("4000");
        assertThat(priced.total()).isEqualByComparingTo("76000");
    }

    private static Food food(Long id, String name, long price) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setPrice(BigDecimal.valueOf(price));
        f.setAvailable(true);
        f.setImageUrl("/images/foods/x.webp");
        return f;
    }

    private static Category category(Long id) {
        Category c = new Category();
        c.setId(id);
        c.setName("Món chính");
        return c;
    }

    private static com.foodordering.entity.User user(Long id) {
        com.foodordering.entity.User u = new com.foodordering.entity.User();
        u.setId(id);
        u.setEmail("khach@example.com");
        return u;
    }

    private static Promotion promotion(String name, String code, Promotion.DiscountType type, long value) {
        Promotion p = new Promotion();
        p.setId(1L);
        p.setName(name);
        p.setCode(code);
        p.setDiscountType(type);
        p.setDiscountValue(BigDecimal.valueOf(value));
        p.setScope(Promotion.Scope.GLOBAL);
        p.setActive(true);
        p.setStartsAt(NOW.minusDays(1));
        p.setEndsAt(NOW.plusDays(1));
        return p;
    }
}
```

---

## 2.2. Kiểm thử Tự động E2E phía Client (Playwright)

Kiểm thử End-to-End (E2E) sử dụng **Playwright** mô phỏng hành vi người dùng thực tế trên trình duyệt, kiểm chứng toàn diện từ UI React đến Backend Spring Boot và CSDL PostgreSQL.

### 2.2.1. Cấu hình cài đặt Playwright

Trong thư mục `client/`:
```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

File cấu hình `client/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  retries: 1,
  workers: 2,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

Thêm script vào `client/package.json`:
```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

### 2.2.2. Kịch bản E2E Test Suite chi tiết

Thư mục: `client/e2e/`

#### 1. Kịch bản Đăng nhập & Điều hướng: `auth.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E - Xác thực người dùng', () => {
  test('Đăng nhập thành công với tài khoản demo', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'user@demo.com');
    await page.fill('input[type="password"]', 'user1234');
    await page.click('button[type="submit"]');

    // Chuyển hướng về trang chủ và menu người dùng xuất hiện
    await expect(page).toHaveURL('/');
    await expect(page.locator('header')).toContainText('user@demo.com');
  });

  test('Hiển thị lỗi khi sai mật khẩu', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'user@demo.com');
    await page.fill('input[type="password"]', 'sai_mat_khau');
    await page.click('button[type="submit"]');

    await expect(page.locator('.ant-message-error, .ant-alert-error')).toBeVisible();
  });
});
```

#### 2. Kịch bản Lọc món & Đặt hàng: `order-flow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E - Luồng Đặt món & Thanh toán', () => {
  test.beforeEach(async ({ page }) => {
    // Đăng nhập trước khi thực hiện đặt hàng
    await page.goto('/login');
    await page.fill('input[type="email"]', 'user@demo.com');
    await page.fill('input[type="password"]', 'user1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('Thêm món vào giỏ và đặt hàng COD thành công', async ({ page }) => {
    // 1. Thêm món Phở bò vào giỏ
    const phoCard = page.locator('.food-card', { hasText: 'Phở bò' }).first();
    await phoCard.locator('button', { hasText: 'Thêm' }).click();

    // 2. Chuyển sang trang giỏ hàng
    await page.goto('/cart');
    await expect(page.locator('text=Phở bò')).toBeVisible();

    // 3. Điền thông tin giao hàng
    await page.fill('input[name="receiverName"]', 'Nguyễn Văn Test');
    await page.fill('input[name="phone"]', '0901234567');
    await page.fill('textarea[name="address"]', '123 Đường Test, Cần Thơ');
    
    // 4. Chọn phương thức COD
    await page.check('input[value="COD"]');

    // 5. Xác nhận đặt món
    await page.click('button:has-text("Đặt hàng")');

    // 6. Điều hướng về trang /orders và thấy đơn hàng mới
    await expect(page).toHaveURL('/orders');
    await expect(page.locator('.order-item').first()).toContainText('Chờ xác nhận');
  });
});
```

#### 3. Kịch bản Chatbot tương tác: `chatbot.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E - Tương tác Chatbot AI', () => {
  test('Mở widget chatbot, gửi tin nhắn và nhận thẻ món gợi ý', async ({ page }) => {
    await page.goto('/');

    // 1. Bấm mở widget chatbot
    const chatFab = page.locator('button[aria-label="chat"], .chatbot-fab');
    await chatFab.click();

    // 2. Nhập câu hỏi tư vấn
    const input = page.locator('textarea[placeholder*="Hỏi chatbot"], input[placeholder*="Nhập"]');
    await input.fill('Tư vấn món chay không cay');
    await page.keyboard.press('Enter');

    // 3. Chờ phản hồi và kiểm tra thẻ món gợi ý xuất hiện
    const botReply = page.locator('.chat-bubble-bot').last();
    await expect(botReply).toBeVisible({ timeout: 15000 });

    const suggestedCards = page.locator('.chat-food-card');
    await expect(suggestedCards.first()).toBeVisible();
  });
});
```

#### 4. Kịch bản Phân quyền Quản trị: `admin-guard.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E - Phân quyền Quản trị viên', () => {
  test('Khách hàng thường bị chặn khi truy cập trang Quản trị', async ({ page }) => {
    // Đăng nhập tài khoản khách thường
    await page.goto('/login');
    await page.fill('input[type="email"]', 'user@demo.com');
    await page.fill('input[type="password"]', 'user1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Cố truy cập trang admin
    await page.goto('/admin/dashboard');

    // Bị chuyển hướng hoặc hiển thị trang thông báo không có quyền
    await expect(page).not.toHaveURL('/admin/dashboard');
  });

  test('Admin đăng nhập vào Dashboard và cập nhật trạng thái đơn', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@demo.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/orders');
    await expect(page).toHaveURL('/admin/orders');
    await expect(page.locator('h1, h2')).toContainText('Quản lý đơn hàng');
  });
});
```

---

## 2.3. Ma trận tổng hợp Đối sánh Kiểm thử

| Tiêu chí | Kiểm thử Thủ công (Manual) | Kiểm thử Đơn vị Server (JUnit 5) | Kiểm thử E2E Client (Playwright) |
|---|---|---|---|
| **Mục tiêu chính** | Khám phá trải nghiệm UI/UX, kiểm thử chéo, thẩm định cảm quan người dùng | Thuật toán tính tiền, lọc món, kiểm tra ràng buộc biên, bảo mật backend | Tính toàn vẹn luồng tương tác trên trình duyệt, đồng bộ giỏ hàng, DOM UI |
| **Tốc độ thực thi** | Chậm (thực hiện theo đợt nghiệm thu) | Cực nhanh (< 10 giây cho toàn bộ suite) | Trung bình (1–3 phút cho toàn bộ luồng) |
| **Phụ thuộc môi trường** | Cần đầy đủ cả stack Prod/Dev | Không cần DB, không cần Docker (Dùng Mockito) | Cần Frontend chạy và kết nối Backend đang hoạt động |
| **Tần suất chạy** | Trước mỗi đợt bảo vệ / release | Mỗi lần `mvn package` / commit mã nguồn | Định kỳ trước khi đóng gói bản nộp hoặc qua CI/CD |
