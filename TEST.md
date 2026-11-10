# TEST.md — Kế hoạch và Tài liệu Kiểm thử FoodOrdering

Tài liệu này được cơ cấu thành hai phần trọng tâm phục vụ đánh giá chất lượng toàn diện của hệ thống FoodOrdering:
1. **Phần 1: Kiểm thử thủ công (Manual Testing)** — Kế hoạch kiểm thử, ma trận kịch bản kiểm thử chức năng theo Use Case và kiểm chứng các ràng buộc biên.
2. **Phần 2: Kiểm thử tự động (Automated Testing)** — Unit test phía Server (Vitest, TypeScript) và E2E test phía Client (Playwright, legacy, không chạy CI).

---

# Phần 1. Kiểm thử thủ công (Manual Testing)

## 1.1. Kế hoạch và mục tiêu kiểm thử

### Mục tiêu kiểm thử
- **MT1 — Đầy đủ chức năng:** Đảm bảo toàn bộ luồng nghiệp vụ hoạt động trơn tru theo đặc tả (xác thực, thực đơn, giỏ hàng, tính giá khuyến mãi tự động, thanh toán mô phỏng, đơn hàng, quản trị món/danh mục/khách hàng/báo cáo).
- **MT2 — Toàn vẹn dữ liệu & Ràng buộc biên:** Dữ liệu tính toán từ server luôn chính xác (giá lấy từ DB, không tin client; tổng tiền voucher không âm; chuyển đổi trạng thái đơn 1 chiều).
- **MT3 — Chatbot an toàn & tin cậy:** Chatbot AI tư vấn chuẩn xác từ thực đơn thật, **tuyệt đối không bịa món, bịa giá, hay bịa trạng thái phục vụ**; chuyển nhánh dự phòng (fallback) mượt mà khi AI timeout hoặc API key lỗi.
- **MT4 - Phân quyền & Bảo mật:** Kiểm soát quyền hạn chặt chẽ ở cấp API backend (middleware `requireAuth`/`requireRole`), không phụ thuộc việc ẩn/hiện UI. Tài khoản bị khoá mất quyền tức thời.

### Môi trường và Dữ liệu mẫu (prisma/seed.ts)
- **Tài khoản quản trị:** `namnguyen@demo.com` / `namnguyen` (Nguyễn Hoàng Nam, vai trò `ADMIN`), `huongtran@demo.com` / `huongtran` (Trần Thu Hương, vai trò `ADMIN`)
- **Tài khoản khách hàng:** `tuanpham@demo.com` / `tuanpham` (Phạm Văn Tuấn), `khangnguyen@demo.com` / `khangnguyen` (Nguyễn Minh Khang), `thaotran@demo.com` / `thaotran` (Trần Phương Thảo), `linhduong@demo.com` / `linhduong` (Dương Ngọc Linh), `sonnguyen@demo.com` / `sonnguyen` (Nguyễn Thanh Sơn), `trungdang@demo.com` / `trungdang` (Đặng Quốc Trung), `duchoang@demo.com` / `duchoang` (Hoàng Minh Đức), `tunghoang@demo.com` / `tunghoang` (Hoàng Thanh Tùng). Mật khẩu bằng phần trước dấu `@` trong email.
- **Dữ liệu nạp sẵn:** 5 danh mục, 32 món ăn (28 còn phục vụ, 4 ngừng phục vụ), 4 chương trình khuyến mãi tự động ("Cuối tuần mát lạnh", "Món may mắn hôm nay", "Giảm 10k cho đơn từ 100k", "Ưu đãi buổi trưa"), 15 đơn hàng mẫu đủ 5 trạng thái (`PENDING`, `CONFIRMED`, `PREPARING`, `COMPLETED`, `CANCELLED`), 12 đánh giá mẫu, 5 thông báo và 4 dòng giỏ mẫu.

---

## 1.2. Kịch bản kiểm thử thủ công (Test Cases)

> **Quy ước:** Các cột *Kết quả thực tế* và *Đánh giá (Pass/Fail)* để trống cho kiểm thử viên ghi nhận khi thực thi.

### 1.2.1. Xác thực và Tài khoản (UC01 – UC05)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-AUTH-01 | Đăng nhập thành công | Tài khoản `tuanpham@demo.com` tồn tại | Nhập `tuanpham@demo.com` / `tuanpham` | Đăng nhập thành công, điều hướng về trang chủ, thanh header chuyển sang menu tài khoản | | |
| TC-AUTH-02 | Đăng nhập sai mật khẩu | Tài khoản `tuanpham@demo.com` tồn tại | Nhập `tuanpham@demo.com` / `sai_mat_khau` | HTTP 401, thông báo "Mật khẩu không đúng", không cấp token | | |
| TC-AUTH-03 | Đăng nhập email không tồn tại | — | Nhập `nonexistent@demo.com` / `tuanpham` | HTTP 401, thông báo "Email không tồn tại" | | |
| TC-AUTH-04 | Đăng ký thành công | Email chưa đăng ký | Nhập email mới, pass `matkhau123`, SĐT `0901234567`, họ tên | Tạo tài khoản thành công, tự động tặng voucher `WELCOME` vào ví, cấp token | | |
| TC-AUTH-05 | Đăng ký trùng email | Đã có `tuanpham@demo.com` | Đăng ký với email `tuanpham@demo.com` | HTTP 400, thông báo lỗi email đã tồn tại | | |
| TC-AUTH-06 | Đăng ký mật khẩu < 8 ký tự | — | Nhập mật khẩu `1234567` (7 ký tự) | Báo lỗi validation phía client và backend HTTP 400 | | |
| TC-AUTH-07 | Đăng ký SĐT không hợp lệ | — | Nhập SĐT `12345` hoặc `01234567891` | Báo lỗi SĐT phải đúng định dạng 10 chữ số (bắt đầu bằng 0) | | |
| TC-AUTH-08 | Đăng nhập tài khoản bị khoá | Admin đã khoá `tuanpham@demo.com` | Đăng nhập bằng `tuanpham@demo.com` / `tuanpham` | HTTP 403, thông báo "Tài khoản đã bị khóa" | | |
| TC-AUTH-09 | Cập nhật hồ sơ cá nhân | Đã đăng nhập | Vào `/profile`, sửa họ tên, SĐT, địa chỉ mặc định | HTTP 200, thông tin được cập nhật chính xác vào CSDL | | |
| TC-AUTH-10 | Đổi mật khẩu hợp lệ | Đã đăng nhập | Nhập mật khẩu hiện tại đúng và mật khẩu mới ≥ 8 ký tự | HTTP 200, mật khẩu mới có hiệu lực ngay | | |
| TC-AUTH-11 | Đổi mật khẩu với pass cũ sai | Đã đăng nhập | Nhập mật khẩu cũ sai | HTTP 400, thông báo "Mật khẩu hiện tại không đúng", giữ nguyên pass cũ | | |
| TC-AUTH-12 | Đăng xuất | Đã đăng nhập | Nhấn nút "Đăng xuất" trên menu | Xoá token khỏi storage, giỏ hàng về rỗng (không còn giỏ local), bảo vệ các route yêu cầu đăng nhập | | |
| TC-AUTH-13 | Khách mở giỏ khi chưa đăng nhập | Chưa đăng nhập | Bấm nút giỏ trên header | Chuyển sang `/login`; sau khi đăng nhập quay lại đúng trang đang xem và **drawer giỏ tự mở** | | |

### 1.2.2. Khám phá Thực đơn, Combo & Tìm kiếm (UC06 – UC08)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-MENU-01 | Xem danh sách món & phân trang | Trang chủ `/` | Cuộn danh sách món, bấm số trang | Lưới thẻ món 2 cột mobile / 4 cột từ 768px; 12 món mỗi trang, URL có `page`, đổi trang cuộn về đầu lưới; kèm giá, tag ăn kiêng, độ cay | | |
| TC-MENU-02 | Lọc theo danh mục | Trang chủ `/` | Bấm ô danh mục có ảnh "Món Việt" trên dải danh mục | URL cập nhật `?category={id}`, ô danh mục được tô viền, lưới chỉ còn món thuộc danh mục đã chọn | | |
| TC-MENU-03 | Tìm kiếm theo từ khóa & Giá | Trang chủ `/` | Nhập từ khóa "bún", bấm dải giá 50.000đ - 100.000đ | Lưới món lọc đúng các món chứa từ khóa trong tên và nằm trong khoảng giá; URL có `keyword`, `min`, `max` | | |
| TC-MENU-05 | Tìm không dấu & không phân biệt hoa thường | Trang chủ `/` | Gõ "pho bo", "ca phe", "do uong" vào ô tìm kiếm | Lần lượt ra "Phở bò", "Cà phê sữa đá", các món Đồ uống; server lọc qua `text-normalizer.ts` (không cần PostgreSQL `unaccent`) | | |
| TC-MENU-07 | Enter giữ bộ lọc hiện tại | Đang lọc theo danh mục + khoảng giá trên `/` | Gõ từ khóa mới rồi nhấn Enter | URL giữ nguyên `category`/`min`/`max` và cập nhật `keyword` tức thì (không đợi debounce), lưới món lọc theo cả bộ lọc cũ + từ khóa mới | | |
| TC-MENU-08 | Enter khi đang ở trang khác | Đang ở `/orders` hoặc `/checkout` | Gõ từ khóa trong ô tìm kiếm rồi nhấn Enter | Quay về `/` kèm `?keyword=...`; không mất dữ liệu trang đang xem khi dùng nút Quay lại | | |
| TC-MENU-09 | Bố cục lưới và thanh lọc theo bề rộng | Trang chủ `/` | Thu hẹp/phóng cửa sổ lần lượt 360px, 768px, 1024px, 1280px rồi cuộn lưới món | 360px: 2 cột, chip lọc và dải giá xuống dòng, không có thanh cuộn ngang; từ 768px: 4 cột, thanh lọc vẫn dính khi cuộn; header luôn một hàng ở mọi cỡ | | |
| TC-MENU-04 | Xem chi tiết món ăn | Có món "Phở bò" | Bấm vào thẻ "Phở bò" | Mở **trang riêng** `/foods/:id` (không phải Drawer), hiện ảnh lớn, mô tả, thành phần, cảnh báo dị ứng, đánh giá sao; giá giảm khớp giá trên thẻ | | |
| TC-MENU-06 | Món ngừng phục vụ | Món có `available = false` | Xem món trên thực đơn | Thẻ món hiển thị nhãn "Hết món", ảnh xám, nút "Tạm hết" bị vô hiệu hoá | | |
| TC-MENU-10 | Quay lại giữ bộ lọc và vị trí cuộn | Đang lọc + đã cuộn sâu trong lưới món | Mở chi tiết một món rồi bấm "Quay lại thực đơn" | Trở về đúng URL có bộ lọc cũ và cuộn về đúng vị trí đã rời đi | | |
| TC-MENU-11 | Danh mục, ưu đãi và hero | Trang chủ `/`, chưa có bộ lọc | Xem phần đầu trang | Hero ghi địa bàn Cần Thơ, số món/danh mục thật; dải danh mục có ảnh; "Ưu đãi hôm nay" chỉ gồm món có `discountPercent > 0`, bấm "Xem tất cả" bật lọc `deal=1`; có bộ lọc thì hero ẩn | | |
| TC-MENU-12 | Hero full-bleed | Trang chủ `/`, chưa có bộ lọc | Xem phần đầu trang | Hero trải hết bề ngang vùng cuộn, cao 180/220/260px theo breakpoint, chữ trắng đạt AA, không còn slogan; hero biến mất khi có bộ lọc | | |
| TC-MENU-13 | Chip danh mục | Trang chủ `/` | Cuộn dải danh mục | Chip cao 36px, ảnh tròn 28px, active nền amber đậm chữ trắng; dải cùng ngôn ngữ với hàng chip lọc | | |
| TC-MENU-14 | Sắp xếp bằng dropdown | Trang chủ `/` | Bấm "Sắp xếp: Mặc định" | Dropdown radio hiện 4 lựa chọn, chọn xong URL có `sort`, thanh sticky chỉ còn chip lọc | | |

### 1.2.3. Giỏ hàng & Định giá Khuyến mãi (UC09 – UC12, lớp pricing)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-CART-01 | Thêm món vào giỏ | Đã đăng nhập, món còn phục vụ | Bấm nút dấu cộng trên ảnh thẻ món ở trang chủ | Toast "Đã thêm ... vào giỏ", badge giỏ tăng; **không** mở drawer và vẫn ở trang chủ | | |
| TC-CART-02 | Tăng số lượng món trùng | Đã đăng nhập, giỏ đã có Phở bò (1) | Bấm thêm Phở bò lần nữa | Giỏ cập nhật dòng Phở bò thành số lượng 2 (không tạo dòng trùng lặp) | | |
| TC-CART-04 | Cập nhật số lượng / Xoá dòng trong drawer | Đã đăng nhập, giỏ có món | Mở drawer giỏ, tăng/giảm số lượng hoặc bấm xoá dòng | Drawer trượt từ bên phải; tổng tiền cập nhật theo báo giá mới nhất; số cũ vẫn hiện kèm nhãn "Đang cập nhật giá..." thay vì nháy trắng | | |
| TC-CART-05 | Khuyến mãi tự động (Auto-promo) | Đã đăng nhập, thứ Bảy/Chủ Nhật, có CT "Cuối tuần mát lạnh" (-20% đồ uống) | Thêm 1 đồ uống và 1 món ăn vào giỏ | Đồ uống được giảm 20%, món ăn giữ nguyên giá; chiết khấu hiển thị theo dòng | | |
| TC-CART-06 | Khách chưa đăng nhập không thêm được món | Chưa đăng nhập | Focus (Tab) nút dấu cộng rồi bấm | Nút vô hiệu hoá, bấm không thêm món và không mở chi tiết món; giỏ header vẫn 0 | | |
| TC-CART-07 | Món hết khi chưa đăng nhập | Chưa đăng nhập, món có `available = false` | Xem thẻ món | Nút dấu cộng vô hiệu hoá, thẻ hiện nhãn "Hết món" trên ảnh | | |
| TC-CART-08 | Báo giá khớp giỏ khi thêm từ chatbot | Đã đăng nhập, giỏ có 1 món có khuyến mãi | Mở chatbot, thêm món thứ hai bằng nút giỏ trên thẻ món, rồi tăng/giảm số lượng liên tục | Không có dòng "Hết món" giả; thành tiền từng dòng, tổng giảm và tổng thanh toán khớp báo giá mới nhất; request quote cũ bị abort, không ghi đè số mới | | |
| TC-CART-09 | Thêm từ trang chi tiết mở drawer | Đã đăng nhập, đang ở `/foods/:id` | Chọn số lượng rồi bấm "Thêm vào giỏ" | Toast xác nhận và drawer giỏ **tự mở** để khách thấy món vừa thêm | | |
| TC-CART-10 | Giỏ trống | Đã đăng nhập, giỏ rỗng | Bấm nút giỏ trên header | Drawer mở, hiện trạng thái rỗng với nút "Khám phá thực đơn"; không gọi quote | | |
| TC-CART-11 | `/cart` chuyển hướng | Đã đăng nhập | Mở thẳng `/cart` | Chuyển về `/checkout`; không còn trang giỏ riêng | | |
| TC-CART-12 | Hoàn tác khi xoá món | Đã đăng nhập, giỏ có món | Bấm `Xóa` trên một dòng | Dòng biến mất, toast "Đã xóa …" hiện 5 giây kèm nút "Hoàn tác"; bấm hoàn tác đưa lại đúng món và số phần | | |
| TC-CART-13 | Gợi ý món liên quan | Đã đăng nhập, giỏ chưa có đồ uống/tráng miệng | Mở drawer giỏ | Shelf "Thêm cho bữa này" hiện tối đa 3 món đồ uống/tráng miệng; bấm `+` thêm vào giỏ ngay và shelf cập nhật | | |
| TC-CART-14 | Footer compact khi có/không giảm giá | Đã đăng nhập, giỏ có món | Mở drawer giỏ | Có giảm giá thì hiện Tạm tính + Giảm giá + Tổng; không giảm giá thì chỉ Tổng; footer không quá 210px cao | | |

### 1.2.4. Đặt hàng & Vòng đời Đơn hàng (UC12 – UC16, UC30 – UC31)

| Mã TC | Chức năng | Tiền điều kiện | Thao tác / Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|-------|-----------|----------------|------------------------|-------------------|------------------|-----------|
| TC-ORD-01 | Đặt hàng COD thành công | Giỏ có món hợp lệ | Từ drawer giỏ bấm "Tiến hành đặt món", điền tên, SĐT, địa chỉ, chọn COD, bấm "Xác nhận đặt món" | Mở `/checkout` (một trang duy nhất), tạo đơn `status = PENDING`, `paymentStatus = UNPAID`, giỏ được dọn sạch, chuyển sang `/orders` | | |
| TC-ORD-02 | Đặt hàng phương thức QR | Giỏ có món hợp lệ | Chọn phương thức QR, hoàn tất đặt | Tạo đơn với `payment_method = QR`, hiển thị mã QR mô phỏng chuẩn `FOOD-{id}-{total}` | | |
| TC-ORD-03 | Giá luôn lấy từ DB | Khách gửi request API sửa đổi giá món = 1đ | Gọi `POST /api/orders` với payload can thiệp | Server tính lại toàn bộ theo giá CSDL, bỏ qua giá client gửi lên | | |
| TC-ORD-04 | Chặn đặt món đã hết | Có món vừa chuyển `available = false` | Gửi request đặt đơn có món này | HTTP 400, thông báo món đã ngừng phục vụ, huỷ toàn bộ transaction đặt hàng | | |
| TC-ORD-05 | Khách thanh toán đơn QR | Có đơn QR `PENDING` + `UNPAID` | Bấm "Thanh toán", xác nhận | Mã QR đếm ngược 1 phút, hết hạn thì che QR và khoá nút xác nhận, bấm "Tạo mã mới" để đếm lại; xác nhận chuyển đơn sang `PAID`, sinh thời gian `paidAt`, gửi thông báo cho khách | | |
| TC-ORD-06 | Khách tự huỷ đơn hợp lệ | Đơn `PENDING` **và** `UNPAID` | Bấm "Huỷ đơn" trong `/orders` | HTTP 200, đơn chuyển thành `CANCELLED`, gửi thông báo huỷ đơn | | |
| TC-ORD-07 | Chặn huỷ đơn đã thanh toán | Đơn `PENDING` nhưng đã `PAID` | Cố gắng huỷ đơn | HTTP 400, không cho phép khách tự huỷ đơn đã thu tiền | | |
| TC-ORD-08 | Chặn huỷ đơn đã xác nhận/đang vận chuyển | Đơn `CONFIRMED` hoặc `PREPARING` | Cố gắng huỷ đơn | HTTP 400, không cho phép khách huỷ khi quán đã tiếp nhận/đang vận chuyển | | |
| TC-ORD-09 | Đặt lại đơn hàng cũ | Đơn cũ `COMPLETED` | Bấm nút "Đặt lại" | Tự động thêm các món còn bán vào giỏ, loại bỏ món ngừng phục vụ, không mang theo ghi chú cũ, rồi mở drawer giỏ tại chỗ | | |
| TC-ORD-10 | Bảo mật dữ liệu đơn hàng | Có 2 tài khoản khách A và B | Khách B cố truy vấn đơn hàng của khách A | API chặn trả về dữ liệu (chỉ xem được đơn của chính mình) | | |
| TC-ORD-11 | Nút Huỷ đơn chỉ ở đơn hợp lệ | Đơn `CONFIRMED` hoặc `PREPARING` | Mở `/orders` và xem thẻ đơn | Không hiển thị nút "Huỷ đơn" (điều kiện theo `canCancelOrder`), server vẫn chặn nếu gọi thẳng API | | |
| TC-ORD-12 | PENDING đã thanh toán hướng hotline | Đơn `PENDING` + `PAID` | Mở `/orders` và xem thẻ đơn | Không có nút "Huỷ đơn", hiện gợi ý gọi hotline 0292.888.9999 để hủy/hoàn tiền | | |
| TC-ORD-13 | Nhãn Đang vận chuyển | Đơn `PREPARING` | Xem danh sách đơn ở `/orders`, timeline, trang admin và thông báo | Nhãn/Thông báo ghi "Đang vận chuyển" (không còn "Đang chế biến"); timeline tự vẽ đánh dấu đúng bước hiện tại; nút admin từ `CONFIRMED` ghi "Giao hàng" | | |
| TC-ORD-14 | Nút Đặt lại chỉ ở đơn giao xong | Đơn `PENDING`/`CONFIRMED`/`PREPARING` | Mở `/orders` và xem thẻ đơn | Không hiển thị nút "Đặt lại"; đơn `COMPLETED` vẫn có nút | | |
| TC-ORD-15 | Tab trạng thái trên URL | Có đơn ở nhiều trạng thái | Bấm tab "Đang vận chuyển", sau đó tải lại trang | URL thành `/orders?status=PREPARING`, chỉ hiện đơn `PREPARING`; tải lại vẫn đúng tab; mỗi tab hiện số đơn tương ứng | | |
| TC-ORD-16 | Bố cục thẻ đơn | Có ít nhất một đơn | Xem thẻ đơn ở `/orders` | Thẻ có mã `FO-xxxx`, giờ đặt, pill "Đã/Chưa thanh toán", timeline 4 bước, ảnh từng món, giảm giá, tổng tiền, ghi chú và các nút thao tác; hotline Cần Thơ hiện trên đầu trang | | |
| TC-ORD-17 | Trang đặt món một trang | Giỏ có món | Mở `/checkout` | Chỉ còn địa chỉ, thanh toán, ghi chú và cột tóm tắt; danh sách món không lặp lại, "Sửa giỏ" mở drawer; nút xác nhận khoá khi quote đang tải/lỗi | | |
| TC-ORD-18 | Thanh đáy trên mobile | Màn hình dưới 1024px, giỏ có món | Mở `/checkout` và cuộn xuống cuối | Thanh đáy chỉ gồm tổng tiền và một nút "Đặt món"; nội dung cuối không bị thanh che; nút chatbot nhảy lên trên thanh | | |

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
| TC-BOT-10 | Nhánh dự phòng (Fallback - lỗi tạm thời) | AI hết thời gian chờ, trả 429/5xx hoặc JSON sai, hỏi "Món chay không cay" | Server chuyển sang `selectFoodsByCode()`, trả lời tóm tắt 1 dòng + hiển thị đúng thẻ món chay không cay từ DB; không phải banner "chưa cấu hình" | | |
| TC-BOT-11 | Thiếu khóa API | `.env` không có `AI_API_KEY` (rỗng), mở khung chat rồi thử hỏi "Món chay không cay" | `GET /api/chatbot/status` trả `available = false`; banner "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau." hiện dưới thanh tiêu đề; ô nhập và nút gửi bị khóa. Gọi thẳng `POST /api/chat` thì trả 503, không gọi mạng tới AI và không lưu lịch sử | | |
| TC-BOT-11b | Khóa API không hợp lệ | `AI_API_KEY` có giá trị nhưng sai/hết hạn, mở trang chủ | Ngay khi mở khung chat đã thấy banner "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau." (không cần gửi câu hỏi), ô nhập bị khóa, không có thẻ món; `GET /api/chatbot/status` trả `available = false` sau lần kiểm tra khóa đầu tiên | | |
| TC-BOT-12 | Chỉ giữ thẻ của lượt mới nhất | Hỏi 3 câu liên tiếp, mỗi câu đều có gợi ý món | Khung chat chỉ còn tối đa 5 thẻ ở tin bot mới nhất; tin bot cũ vẫn giữ chữ nhưng không còn thẻ; không còn nút "Xem thực đơn" | | |
| TC-BOT-13 | Ngân sách là tổng bộ gợi ý | Hỏi "Bữa tối 200k cho 2 người" | Tổng `totalPrice` của tất cả thẻ ≤ 200.000đ; cấu hình `max_suggestions` cũ 8/10 vẫn chỉ trả tối đa 5 thẻ | | |
| TC-BOT-14 | Hỏi tiếp theo ngữ cảnh | Sau lượt gợi ý món, hỏi "Món đó cay không?" | Server dùng `lastFoodIds`, chỉ trả món trong nhóm vừa gợi ý đã áp ràng buộc cay; không quét sang món ngoài ngữ cảnh | | |
| TC-BOT-15 | Chủ đề mới không dính ngữ cảnh cũ | Sau lượt gợi ý món mặn, hỏi "Món đó có món chay không?" | Bỏ qua `lastFoodIds`, tìm trên toàn thực đơn; chỉ trả món có nhãn "chay" | | |
| TC-BOT-16 | Khách vãng lai thêm món từ thẻ chatbot | Chưa đăng nhập, mở chatbot có thẻ món | Nút thêm vào giỏ bị disabled kèm tooltip "Đăng nhập để thêm món vào giỏ"; bấm vào không thêm món và không điều hướng sang chi tiết món | | |

| TC-BOT-11 | Khách vãng lai không lưu lịch sử | Khách chưa đăng nhập gửi 2 câu hỏi liên tiếp | Tin nhắn không được lưu vào `chat_message`; ngữ cảnh lấy từ `history`/`lastFoodIds` do client gửi kèm nên bot vẫn trả lời liên tục trong cùng khung | | |
| TC-BOT-12 | Giải quyết đại từ tham chiếu | Sau khi gợi ý món, hỏi "món đó rẻ hơn được không?" | Server ghép tên các món vừa gợi ý (tra từ `lastFoodIds`) vào câu hỏi để trích tiêu chí; kết quả lọc dựa trên các món đó, không trả về danh sách không liên quan | | |
| TC-BOT-13 | Validate tiêu chí | AI trích xuất `keywords` quá chặt không khớp món nào | Server bỏ lọc từ khóa, vẫn giữ ràng buộc thuộc tính (cay, dị ứng, nhãn); từ khóa tham chiếu thuần ("món đó") bị loại khỏi `keywords`; không trả danh sách rỗng vô lý | | |
| TC-BOT-17 | Thông tin quán có nguồn | Hỏi "Mấy giờ quán mở cửa?" (đã có tài liệu Giờ mở cửa) | Bot trả nội dung tài liệu, kèm `citations` hiện "Nguồn: Giờ mở cửa", không có thẻ món, không bịa giờ | | |
| TC-BOT-18 | Hướng dẫn đặt hàng | Hỏi "Cách đặt món thế nào?" | Bot trả quy trình (thêm vào giỏ -> thanh toán, hủy PENDING+UNPAID, trạng thái Đang vận chuyển), không có thẻ món, không kèm dòng "Nguồn:" | | |
| TC-BOT-19 | Follow-up hỏi từng bước | Hỏi "Gợi ý món đi" (chưa có số người, ngân sách, ràng buộc) | Bot không trả thẻ món, hỏi "Bạn đang muốn ăn cho mấy người?"; hỏi "Món chay" thì không hỏi nữa mà trả món ngay | | |
| TC-BOT-23 | Follow-up trả lời vắn tắt | Hỏi "Gợi ý món đi", nhận câu hỏi "mấy người?", rồi trả "2" | Câu trả lời được ghép với câu hỏi gốc (hết hạn sau 10 phút): bot gợi ý món với `people = 2` (số phần tự tăng), không bị từ chối là ngoài lề; trả "200k" thì ghép ngân sách tương tự | | |
| TC-BOT-24 | Quick replies sau FOOD | Hỏi "Món ngon dưới 200k" | Bot trả thẻ + hàng nút "Món khác / Món chay không cay / Cách đặt món thế nào?"; bấm "Món khác" ra bộ món mới không trùng các ID vừa hiển thị; tin bot cũ mất nút | | |
| TC-BOT-25 | Nút trả lời follow-up | Hỏi "Gợi ý món đi" | Bot hỏi "mấy người?" kèm nút "1 người / 2 người / 4 người"; bấm "2 người" ra gợi ý với `people = 2` | | |
| TC-BOT-26 | Giải thích lý do chọn món | Có khóa AI thật | Câu trả lời có một câu ngắn nêu vì sao các món phù hợp (số người, ngân sách, cay, dị ứng, nhãn); không lặp lại luật, không nêu ID món | | |
| TC-BOT-20 | Streaming trong widget | Mở widget, gửi câu hỏi, bấm Dừng khi chữ đang chạy | Chữ chạy dần theo từ có status "Đang tìm món...", bấm Dừng giữ phần đã hiện | | |
| TC-BOT-21 | Upload tài liệu RAG | Admin tải lên file PDF/DOCX/TXT, hỏi thông tin quán bằng diễn đạt khác từ khóa | Tài liệu chia thành nhiều đoạn, mỗi đoạn có vector; bot trả lời từ đoạn gần nhất kèm nguồn, không cần trùng từ khóa | | |
| TC-BOT-22 | Vector fail fallback keyword | Tắt extension vector hoặc lỗi embed, hỏi "Giờ mở cửa" | Bot vẫn trả lời từ tài liệu bằng chấm từ khóa, không crash, không bịa | | |

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
| TC-NOTIFY-01 | Mở đơn từ thông báo | Có thông báo gắn đơn, đang đăng nhập | Mở menu tài khoản, chọn "Thông báo", bấm vào thân thông báo | Drawer thông báo mở từ bên phải, đóng lại và chuyển tới `/orders?orderId={id}`, đúng thẻ đơn được cuộn tới và tô ring, thông báo chuyển đã đọc, chấm đỏ trên avatar giảm | | |
| TC-NOTIFY-02 | Thông báo cũ không có `orderId` | Thông báo tạo trước khi thêm `orderId` | Bấm vào thân thông báo | Thông báo chuyển đã đọc, drawer đóng, không điều hướng | | |
| TC-NOTIFY-03 | Xóa thông báo đã đọc | Có cả thông báo đã đọc và chưa đọc | Bấm "Xóa đã đọc" | Chỉ các thông báo `read = true` biến mất, thông báo chưa đọc còn nguyên | | |
| TC-NOTIFY-04 | Xóa một thông báo | Có ít nhất một thông báo | Trên desktop hover thông báo, trên mobile xem trực tiếp, bấm nút xóa | Nút xóa hiện đúng trên cả hai cỡ màn hình, xóa đúng thông báo, không mở đơn hay đóng drawer | | |
| TC-NOTIFY-05 | Chặn thao tác thông báo người khác | Có 2 tài khoản khách A và B | Dùng token của B gọi `POST /api/notifications/{id}/read` hoặc `DELETE` thông báo của A | HTTP 403, thông báo của A không đổi | | |
| TC-NOTIFY-06 | `orderId` không còn tồn tại | Thông báo trỏ tới đơn đã bị xóa | Bấm vào thân thông báo | Vẫn đánh dấu đã đọc và mở `/orders`, trang không lỗi và bỏ qua việc cuộn | | |

---

---

# Phần 2. Kiểm thử tự động (Automated Testing)

> Phần 2 đã được viết lại cho stack mới: unit test phía server chạy bằng **Vitest** (trước đây là JUnit 5 + Mockito); E2E Playwright được **gỡ khỏi CI**, dev tự chạy local.

## 2.1. Kiểm thử Unit Test phía Server (Vitest)

Kiểm thử tự động backend tập trung vào việc bảo vệ các thuật toán lõi và nghiệp vụ biên phức tạp mà không phụ thuộc hạ tầng bên ngoài (chạy độc lập, không cần Docker/DB):
- **pricing.test.ts**: quy tắc giảm giá tự động theo từng dòng, chọn chương trình tốt nhất, chặn giảm giá vượt tổng tiền; ngày/thứ và khung giờ đánh giá theo giờ Việt Nam (không phụ thuộc TZ máy chủ). *(thêm ở branch `refactor/server-commerce`; múi giờ sửa ở `fix/docker-ci-build`)*
- **chatbot tests**: lọc món xác định bằng code, fallback khi AI lỗi, câu hỏi tiếp (follow-up), phân loại intent. *(thêm ở branch `refactor/server-chatbot-admin`)*
- **orderLifecycle.test.ts**: chuyển trạng thái đơn một chiều, hủy PENDING + UNPAID. *(thêm ở branch `refactor/server-commerce`)*
- **textNormalizer.test.ts**: chuẩn hoá tiếng Việt không dấu cho tìm kiếm. *(đã có)*

### 2.1.1. Lệnh thực thi kiểm thử Server

```bash
# Di chuyển vào thư mục server
cd server

# Chạy toàn bộ test suite backend
npm test

# Chạy riêng từng file test
npx vitest run tests/textNormalizer.test.ts
```

Cấu trúc: `server/tests/*.test.ts`. Mock prisma ở mức module (`vi.mock`) nên không cần database.

## 2.2. Kiểm thử E2E phía Client (Playwright — legacy, không chạy CI)

- **CI (GitHub Actions) chỉ kiểm tra build**: `npm run typecheck` + `npm run build` (client) và `npm test` + `npm run build` (server). Không có job e2e.
- `client/e2e/*.spec.ts` là các spec viết cho giao diện AntD/React ban đầu; sau khi client chuyển sang Vue chúng cần cập nhật selector (hoặc viết lại) trước khi dùng nghiêm túc.
- Dev tự chạy local khi cần: `cd client && npm run test:e2e` (cần stack dev đang chạy: `docker compose --profile dev up`).

## 2.3. Ma trận tổng hợp Đối sánh Kiểm thử

| Tiêu chí | Kiểm thử Thủ công (Manual) | Kiểm thử Đơn vị Server (Vitest) | Kiểm thử E2E Client (Playwright) |
|---|---|---|---|
| **Mục tiêu chính** | Khám phá trải nghiệm UI/UX, kiểm thử chéo, thẩm định cảm quan người dùng | Thuật toán tính tiền, lọc món, kiểm tra ràng buộc biên, bảo mật backend | Tính toàn vẹn luồng tương tác trên trình duyệt, đồng bộ giỏ hàng, DOM UI |
| **Tốc độ thực thi** | Chậm (thực hiện theo đợt nghiệm thu) | Cực nhanh (< 10 giây cho toàn bộ suite) | Trung bình (1–3 phút cho toàn bộ luồng) |
| **Phụ thuộc môi trường** | Cần đầy đủ cả stack Prod/Dev | Không cần DB, không cần Docker (mock prisma) | Cần Frontend chạy và kết nối Backend đang hoạt động |
| **Tần suất chạy** | Trước mỗi đợt bảo vệ / release | Mỗi lần commit / CI | Dev tự chạy local (không chạy CI) |
