# TEST.md — Kế hoạch và tài liệu kiểm thử

Tài liệu này gồm ba phần: **kế hoạch kiểm thử** (mục 3.1–3.7 theo mục lục báo cáo), **chi tiết
kịch bản kiểm thử** (mục 3.8–3.9) và **unit test mẫu** cho bộ lọc món của chatbot.

> **Cách dùng:** cột *Kết quả thực tế* và *Pass/Fail* trong các bảng test case để **trống**.
> Người kiểm thử chạy từng kịch bản, ghi kết quả thực tế và đánh dấu đạt/không đạt, rồi tổng
> hợp ở mục 2.6.
>
> **Dữ liệu tham chiếu:** các kỳ vọng trong bảng test case dựa trên **dữ liệu mẫu do
> `DataSeeder` nạp** (5 danh mục, 17 món, 2 tài khoản, 3 đơn, 2 đánh giá, 1 tài liệu tham
> khảo). Danh sách món nằm ở mục 4.1.

---

# Phần 1. Kế hoạch kiểm thử

## 3.1. Mục tiêu kiểm thử

Kiểm thử nhằm chứng minh hệ thống đạt các mục tiêu sau, tương ứng với đề tài và các tiêu chí
chấm điểm của môn CT250E:

| # | Mục tiêu kiểm thử | Tiêu chí rubrics liên quan |
|---|-------------------|---------------------------|
| MT1 | Các chức năng cốt lõi của hệ thống hoạt động đúng theo đặc tả: đăng ký/đăng nhập, duyệt thực đơn, giỏ hàng, đặt món, theo dõi đơn, đánh giá, quản trị | Rubric 2.1 — Tính đầy đủ các chức năng (30%) |
| MT2 | Ứng dụng vận hành ổn định, xử lý lỗi và dữ liệu không hợp lệ đúng mã trạng thái, không rò rỉ chi tiết lỗi hệ thống ra client | Rubric 2.2 — Độ ổn định & Code (30%) |
| MT3 | Giao diện hiển thị đúng, thao tác được trên màn hình nhỏ lẫn màn hình lớn, thông báo lỗi rõ ràng | Rubric 2.3 — Trải nghiệm UI/UX (20%) |
| MT4 | Chatbot **không bịa món, không bịa giá**: mọi món trả về đều tồn tại trong CSDL, giá hiển thị khớp giá trong CSDL, câu hỏi ngoài thực đơn không sinh món giả | Rubric 4.1 — Ý tưởng & công nghệ (10%) |
| MT5 | Phân quyền hoạt động đúng: khách không truy cập được chức năng quản trị, tài khoản bị khoá mất quyền ngay | Rubric 2.2 — Độ ổn định & Code |
| MT6 | Dữ liệu mẫu đầy đủ, quy trình kiểm thử chặt chẽ và lặp lại được | Rubric 2.4 — Kiểm thử & Demo (20%) |

## 3.2. Phạm vi kiểm thử

### 3.2.1. Trong phạm vi

| Nhóm | Nội dung kiểm thử | Use case liên quan |
|------|-------------------|-------------------|
| Xác thực | Đăng ký, đăng nhập, đăng xuất, hồ sơ, đổi mật khẩu | UC01–UC05 |
| Thực đơn | Danh mục, danh sách món, tìm kiếm và lọc theo tên/loại/giá, chi tiết món | UC06–UC08 |
| Giỏ hàng | Thêm, sửa số lượng, xoá, xoá sạch, tổng tiền | UC09–UC11 |
| Đặt món & thanh toán | Tạo đơn, lấy giá từ CSDL, ghi chú, phương thức COD/QR, ghi nhận thanh toán, hủy đơn, đặt lại | UC12–UC16, UC30, UC31 |
| Đánh giá | Xem, viết, sửa, xoá đánh giá; điều kiện phải có đơn hoàn thành | UC17–UC19 |
| Thông báo | Xem thông báo, đánh dấu đã đọc | UC20 |
| Chatbot | Tư vấn theo nhu cầu, khẩu vị, ngân sách, số người, kết hợp món, dị ứng, câu hỏi ngoài phạm vi, món hết hàng | UC21–UC25 |
| Quản trị món | Thêm, sửa, xoá món; tải ảnh; quản lý danh mục | UC26–UC28 |
| Quản trị khách & chatbot | Khoá/mở khoá, xoá tài khoản, nạp/xoá tài liệu RAG, cấu hình chatbot, xem lịch sử hội thoại | UC32–UC35 |
| Bảo mật | Phân quyền theo vai trò, chặn giá trị đầu vào, băm mật khẩu, chống SQL injection ở biểu mẫu | — |

### 3.2.2. Ngoài phạm vi

- Thanh toán qua cổng thanh toán thật (ngân hàng, ví) — hệ thống chỉ mô phỏng.
- Mã QR thật do ngân hàng phát hành — hệ thống chỉ hiện hình minh hoạ sinh từ mã đơn.
- Tải tải và kiểm thử trên thiết bị thật iOS/Android — giao diện là web responsive.
- Hiệu năng tải đồng thời lớn, kiểm thử tải (load test) và kiểm thử xâm nhập chuyên sâu.

## 3.3. Cách tiếp nhận

Quy trình gồm 5 bước, lặp lại theo chu kỳ mỗi lần phát hành phiên bản mới:

1. **Tiếp nhận yêu cầu kiểm thử** — từ `SPEC.md` (35 UC, 49 endpoint) và danh sách ràng buộc
   nghiệp vụ RB1–RB17.
2. **Lập kịch bản** — mỗi yêu cầu sinh ra một hoặc nhiều test case trong mục 2, ghi rõ tiền
   điều kiện, dữ liệu vào và kết quả mong đợi.
3. **Chuẩn bị môi trường** — dựng stack `prod` bằng Docker Compose, nạp dữ liệu mẫu, đăng nhập
   tài khoản demo.
4. **Thực hiện kiểm thử** — chạy từng test case, ghi *Kết quả thực tế* và *Pass/Fail*.
5. **Đánh giá và báo cáo** — tổng hợp ở mục 2.6; lỗi phát hiện được đưa vào backlog và kiểm
   thử lại ở vòng sau.

**Vòng kiểm thử trong niên luận:** vòng 1 là kiểm thử chức năng (mục 2.1–2.4), vòng 2 là kiểm
thử tự động (mục 2.5) và kiểm thử phi chức năng (mục 2.6.2).

## 3.4. Tiêu chí đánh giá kiểm thử

Một test case được coi là **đạt (Pass)** khi *Kết quả thực tế* khớp với *Kết quả mong đợi*
về mặt hành vi quan sát được (mã trạng thái HTTP, nội dung phản hồi, dữ liệu hiển thị trên
giao diện, trạng thái trong CSDL).

| Mức | Điều kiện | Hành động |
|-----|-----------|-----------|
| **Pass** | Kết quả thực tế khớp hoàn toàn kết quả mong đợi | Ghi nhận, đóng test case |
| **Fail** | Kết quả thực tế khác kết quả mong đợi | Ghi nhận lỗi, mở lỗi (bug), đưa vào backlog sửa |
| **Blocked** | Không thực hiện được vì môi trường chưa sẵn sàng (ví dụ chưa có `AI_API_KEY` hợp lệ) | Ghi rõ lý do, kiểm thử lại khi môi trường sẵn sàng |

**Tiêu chí nghiệm thu:** tất cả test case có trạng thái Pass hoặc đã được ghi nhận lý do Fail
kèm phân tích nguyên nhân; không còn test case nào ở trạng thái Blocked do lỗi môi trường.

## 3.5. Tiêu chí đình chỉ và yêu cầu bắt đầu lại

### 3.5.1. Tiêu chí đình chỉ kiểm thử (Stop-the-test)

Dừng kiểm thử ngay và báo cáo giảng viên hướng dẫn khi xuất hiện một trong các trường hợp:

| # | Điều kiện đình chỉ |
|---|------------------|
| S1 | Ứng dụng không khởi động được, hoặc server trả 5xx cho mọi request |
| S2 | Tài khoản quản trị `admin@demo.com` không đăng nhập được, khiến không kiểm thử được toàn bộ nhóm chức năng quản trị (40% yêu cầu của đề tài) |
| S3 | Cơ sở dữ liệu không tạo được bảng, hoặc `DataSeeder` nạp dữ liệu mẫu lỗi |
| S4 | Phân quyền bị hỏng: tài khoản khách thường truy cập được `/api/admin/**` (lỗi bảo mật nghiêm trọng) |
| S5 | Lỗ hổng cho phép nạp tệp tùy ý (ảnh/tài liệu) ngoài phạm vi định dạng cho phép |

### 3.5.2. Yêu cầu bắt đầu lại kiểm thử

Bắt đầu lại vòng kiểm thử mới khi: có bản phát hành mới; thay đổi ảnh hưởng tới phạm vi đã
kiểm thử; hoặc sửa xong lỗi ở nhóm chức năng đã đánh dấu Fail. Khi bắt đầu lại phải chạy lại
toàn bộ test case đã Pass trước đó để chắc chắn không phát sinh hồi quy.

## 3.6. Sản phẩm bàn giao kiểm thử

| # | Sản phẩm | Mô tả | Nơi lưu |
|---|----------|-------|---------|
| SP1 | Kế hoạch kiểm thử | Mục 3.1–3.7 của tài liệu này | Phần 1 |
| SP2 | Bảng test case | ID, UC liên quan, tiền điều kiện, bước, dữ liệu vào, kết quả mong đợi, kết quả thực tế, Pass/Fail | Phần 2 |
| SP3 | Kịch bản chatbot | ≥ 15 câu hỏi mẫu có kết quả mong đợi cụ thể | Mục 2.4 |
| SP4 | Unit test tự động | Bộ lọc món của chatbot (JUnit 5 + Mockito) | Mục 3 + `server/src/test/` |
| SP5 | Unit test ràng buộc biên | Validate biểu mẫu đặt món (JUnit 5 + AssertJ) | `server/src/test/java/com/foodordering/dto/OrderDtosValidationTest.java` |
| SP6 | Báo cáo kết quả | Tổng hợp đạt/không đạt, phân tích nguyên nhân | Mục 2.6 |
| SP7 | Danh sách lỗi phát hiện | Mỗi lỗi kèm mức độ nghiêm trọng và hướng sửa | Mục 2.6.2 |

## 3.7. Quản lý kiểm thử

### 3.7.1. Công cụ hỗ trợ

| Công cụ | Phiên bản | Dùng để |
|---------|-----------|---------|
| JUnit 5 | 5.x (qua `spring-boot-starter-test`) | Khung test tự động phía server |
| Mockito | 5.x | Giả lập repository và `AiClient` để test ở mức service, không cần CSDL |
| AssertJ | 3.x | Khẳng định dạng đọc dễ hiểu |
| Hibernate Validator | 8.x | Kiểm chứng ràng buộc biên của DTO |
| Maven Surefire | 3.x | Chạy test, sinh báo cáo kết quả (`target/surefire-reports/`) |
| Node.js + TypeScript | 20.19+ / 22.12+ | Kiểm tra kiểu dữ liệu client (`npm run typecheck`) |
| Vite | 8.x | Đóng gói bản build client (`npm run build`) |
| Docker Compose | 2.x | Dựng môi trường kiểm thử gồm PostgreSQL, server, client |
| Trình duyệt (Chrome/Edge) | bản mới nhất | Kiểm thử giao diện và thao tác nghiệp vụ |
| DevTools | — | Kiểm tra request/response, console, hiệu năng tải trang |

### 3.7.2. Môi trường kiểm thử

| Thành phần | Yêu cầu | Ghi chú |
|------------|----------|---------|
| Hệ điều hành | Windows 10/11, macOS hoặc Linux | Dùng cùng một môi trường cho cả nhóm để kết quả tái lập được |
| Docker Desktop | phiên bản mới nhất, khởi động được | Cần cho `docker compose --profile prod up --build` |
| JDK | 25 | Build và chạy server |
| Node.js | 20.19+ hoặc 22.12+ | Build client |
| PostgreSQL | 18 (chạy trong container) | Cổng 5432 |
| Biến môi trường | `.env` chứa `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (≥ 32 ký tự), `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `UPLOAD_DIR` | `AI_API_KEY` phải là khóa thật, nếu không chatbot trả thông báo dự phòng và **không** có thẻ món nào |
| Dữ liệu mẫu | 5 danh mục, 17 món, 2 tài khoản, 3 đơn, 2 đánh giá, 1 tài liệu tham khảo, 3 khoá cấu hình | Do `DataSeeder` nạp; seed **chỉ chạy khi bảng `users` còn trống** |

**Lệnh dựng môi trường:**

```bash
# Bắt đầu nhanh (bản build tối ưu)
docker compose --profile prod up --build -d

# Kiểm tra nhanh bằng script có sẵn
cd client && npm run typecheck && npm run build
cd ../server && mvn test
```

**Tài khoản thử nghiệm:**

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Quản trị viên | `admin@demo.com` | `admin123` |
| Khách hàng | `user@demo.com` | `user1234` |

> Cơ chế nạp dữ liệu mẫu là **nạp một lần**: `DataSeeder` kiểm tra `userRepo.count() > 0` rồi
> bỏ qua nếu CSDL đã có dữ liệu. Muốn nạp lại từ đầu thì xoá volume
> (`docker compose --profile prod down -v`) rồi dựng lại — không có script nạp tay, nhằm tránh
> dữ liệu mẫu lệch với mã nguồn.

---

# Phần 2. Chi tiết kịch bản kiểm thử

> Quy ước cột: **ID** mã test case · **UC** use case liên quan · **Tiền điều kiện** trạng thái
> cần có trước khi chạy · **Bước** thao tác thực hiện · **Dữ liệu vào** giá trị gửi lên ·
> **Kết quả mong đợi** hành vi đúng · **Kết quả thực tế** và **Pass/Fail** để trống cho người
> kiểm thử điền.

## 2.1. Đăng nhập và hồ sơ (UC01–UC05)

| ID | UC | Tiền điều kiện | Bước | Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|----------------|------|-------------|-------------------|------------------|----------|
| TC-DN-01 | UC02 | Có tài khoản `user@demo.com` | 1. Mở `/login`<br>2. Nhập email + mật khẩu đúng<br>3. Nhấn "Đăng nhập" | `user@demo.com` / `user1234` | Chuyển tới trang đã định, thanh điều hướng hiện ô "Đăng nhập" thay bằng menu tài khoản | | |
| TC-DN-02 | UC02 | Có tài khoản `user@demo.com` | Gọi `POST /api/auth/login` | `{ "email": "user@demo.com", "password": "sai_mat_khau" }` | HTTP 401, message "Mật khẩu không đúng", không sinh token | | |
| TC-DN-03 | UC02 | Có tài khoản `user@demo.com` | Gọi `POST /api/auth/login` | `{ "email": "khong_ton_tai@x.com", "password": "user1234" }` | HTTP 401, message "Email không tồn tại" | | |
| TC-DN-04 | UC02 | Không có token | Gọi `GET /api/auth/me` không kèm header | (không có) | HTTP 401 | | |
| TC-DN-05 | UC02 | Có tài khoản `user@demo.com` | Gọi `POST /api/auth/login` rồi dùng token trả về cho `GET /api/auth/me` | Bearer token hợp lệ | HTTP 200, trả về đúng email, `fullName`, `role = CUSTOMER`, `active = true`; **không** có trường `password` | | |
| TC-DN-06 | UC02 | Admin đã khoá `user@demo.com` | Đăng nhập lại bằng tài khoản đã khoá | `user@demo.com` / `user1234` | HTTP 403, message "Tài khoản đã bị khóa" | | |
| TC-DN-07 | UC01 | Email chưa tồn tại | Đăng ký tài khoản mới | `email: "khach.moi@demo.com"`, `password: "matkhau123"`, `fullName: "Khách Mới"`, `phone: "0900000123"`, `address: "12 Láng"` | HTTP 200, trả token; đăng nhập được bằng tài khoản vừa tạo; `role = CUSTOMER` | | |
| TC-DN-08 | UC01 | Email đã tồn tại | Đăng ký lại bằng email có sẵn | `email: "user@demo.com"`, `password: "matkhau123"`, `fullName: "Trùng"`, `phone: "0900000123"` | HTTP 400, message "Email đã tồn tại" | | |
| TC-DN-09 | UC01 | — | Đăng ký với mật khẩu ngắn | `password: "1234567"` (7 ký tự) | HTTP 400, báo lỗi độ dài mật khẩu | | |
| TC-DN-10 | UC01 | — | Đăng ký với số điện thoại sai | `phone: "123"` | HTTP 400, báo lỗi định dạng số điện thoại | | |
| TC-DN-11 | UC04 | Đã đăng nhập | Mở `/profile`, sửa họ tên + SĐT + địa chỉ, lưu | `fullName: "Khách Hàng Demo"`, `phone: "0900000002"`, `address: "12 Láng, Đống Đa"` | HTTP 200; tải lại `/profile` thấy giá trị mới; CSDL cập nhật đúng | | |
| TC-DN-12 | UC05 | Đã đăng nhập | Đổi mật khẩu với mật khẩu cũ sai | `currentPassword: "sai"`, `newPassword: "matkhaumoi123"` | HTTP 400, message "Mật khẩu hiện tại không đúng"; mật khẩu cũ vẫn dùng được | | |
| TC-DN-13 | UC05 | Đã đăng nhập | Đổi mật khẩu hợp lệ | `currentPassword: "user1234"`, `newPassword: "matkhaumoi123"` | HTTP 200; đăng nhậu lại được bằng mật khẩu mới; mật khẩu cũ không còn dùng được | | |
| TC-DN-14 | UC03 | Đã đăng nhập | Nhấn "Đăng xuất" | — | Token bị xoá khỏi `localStorage` và `sessionStorage`; truy cập `/orders` bị đưa về `/login`; giỏ hàng của tài khoản bị xoá khỏi state | | |

## 2.2. Đặt món và thanh toán (UC09–UC16, UC30, UC31)

| ID | UC | Tiền điều kiện | Bước | Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|----------------|------|-------------|-------------------|------------------|----------|
| TC-DM-01 | UC09 | Đã đăng nhập, giỏ trống | Mở `/`, chọn món "Phở bò", bấm "Thêm vào giỏ" | `foodId` của Phở bò, `quantity = 1` | HTTP 200; giỏ có 1 dòng, tổng 65.000đ; thanh giỏ ghim đáy hiện tổng tiền | | |
| TC-DM-02 | UC09 | Đã đăng nhập, giỏ đã có Phở bò | Thêm lại Phở bò | `foodId` của Phở bò, `quantity = 1` | Giỏ gộp thành **một** dòng có `quantity = 2` (không tạo dòng trùng) | | |
| TC-DM-03 | UC09 | Admin đã đặt một món thành `available = false` | Thêm món đó vào giỏ | `foodId` của món ngừng phục vụ | HTTP 400, message nêu rõ món hiện không phục vụ; giỏ không đổi | | |
| TC-DM-04 | UC11 | Giỏ có 1 dòng | Sửa số lượng | `quantity = 3` | Giỏ hiện `quantity = 3`, tổng 195.000đ; tải lại trang vẫn giữ nguyên (lưu trên server) | | |
| TC-DM-05 | UC11 | Giỏ có 2 dòng | Xoá 1 dòng rồi bấm "Xoá tất cả" | — | Giỏ trống; thanh giỏ ghim đáy biến mất | | |
| TC-DM-06 | UC12 | Đã đăng nhập, giỏ có Phở bò × 2 | Đặt món từ `/cart` | `items: [{foodId: <Phở bò>, quantity: 2}]`, `receiverName: "Khách Hàng Demo"`, `phone: "0900000002"`, `address: "12 Láng, Đống Đa"`, `paymentMethod: "COD"`, `note: "Ít cay, gọi trước 10 phút"` | HTTP 200; đơn có `status = PENDING`, `paymentStatus = UNPAID`, `total = 130000`; tạo kèm 1 `payment_transactions` (PENDING) và 1 thông báo; giỏ được xoá; chuyển tới `/orders` | | |
| TC-DM-07 | UC12 | Đã đăng nhập | Gọi `POST /api/orders` với giá do client tự chọn | `items: [{foodId: <Phở bò>, quantity: 1, price: 1}]` | Giá trong đơn lấy từ CSDL = 65.000đ, **không** phải giá client gửi; `total = 65000` | | |
| TC-DM-08 | UC12 | Đã đăng nhập | Gọi `POST /api/orders` với món ngừng phục vụ | `items: [{foodId: <món ngừng phục vụ>, quantity: 1}]` | HTTP 400, message nêu rõ món đã ngừng phục vụ; **không** tạo đơn, không tạo giao dịch thanh toán | | |
| TC-DM-09 | UC12 | Đã đăng nhập | Gọi `POST /api/orders` với ghi chú 256 ký tự | `note: "x" × 256` | HTTP 400, báo lỗi độ dài ghi chú tối đa 255 ký tự | | |
| TC-DM-10 | UC12 | Đã đăng nhập | Gọi `POST /api/orders` với `paymentMethod` không hợp lệ | `paymentMethod: "MOMO"` | HTTP 400, message "Phương thức thanh toán không hợp lệ" | | |
| TC-DM-11 | UC12 | Đã đăng nhập | Đặt món chọn phương thức QR | `paymentMethod: "QR"` | HTTP 200; `orders.payment_method = "QR"`; `payment_transactions.method = "QR"` | | |
| TC-DM-12 | UC13 | Có đơn `PENDING` của chính mình | Mở `/orders`, bấm "Thanh toán", xác nhận | — | HTTP 200; `paymentStatus = PAID`; giao dịch thanh toán chuyển sang `PAID` và có `paidAt`; khách nhận thông báo | | |
| TC-DM-13 | UC14 | Có đơn `PENDING` | Mở `/orders` | — | Danh sách đơn của chính mình hiển thị đúng trạng thái, tổng tiền, phương thức thanh toán (nhãn "Tiền mặt khi nhận" / "Thanh toán bằng mã QR", không lộ mã thôi) | | |
| TC-DM-14 | UC14 | Có đơn của khách khác | Dùng token của khách này gọi `GET /api/orders/my` | — | Chỉ thấy đơn của chính mình, không thấy đơn của người khác | | |
| TC-DM-15 | UC15 | Có đơn `PENDING` | Bấm "Hủy đơn" | — | HTTP 200; `status = CANCELLED`; có thông báo xác nhận hủy | | |
| TC-DM-16 | UC15 | Đơn đã `CANCELLED` | Bấm "Hủy đơn" lần nữa | — | HTTP 400, message "Chỉ đơn đang chờ xác nhận mới hủy được..." | | |
| TC-DM-17 | UC15 | Có đơn `PREPARING` | Gọi `PATCH /api/orders/{id}/cancel` | — | HTTP 400 — đơn đã vào chế biến không tự hủy được | | |
| TC-DM-18 | UC13 | Đơn `PENDING` chọn `paymentMethod = "QR"` | Mở modal thanh toán | — | Hiện mã QR minh hoạ kèm cảnh báo "Thanh toán mô phỏng"; mã QR **không** hiện với phương thức COD | | |
| TC-DM-19 | UC30 | Đã đăng nhập admin, có đơn `PENDING` | Chuyển đơn sang "Đã xác nhận" | `status: "CONFIRMED"` | HTTP 200; `status = CONFIRMED`; khách nhận thông báo | | |
| TC-DM-20 | UC30 | Đơn `CONFIRMED` | Thử chuyển thẳng sang `COMPLETED` | `status: "COMPLETED"` | HTTP 400 — trạng thái đơn đi đúng một chiều, không nhảy cóc | | |
| TC-DM-21 | UC30 | Đơn `COMPLETED` | Thử chuyển trạng thái bất kỳ | `status: "PENDING"` | HTTP 400 — đơn đã chốt không đổi trạng thái được | | |
| TC-DM-22 | UC31 | Đã đăng nhập admin, đơn `UNPAID` | Ghi nhận đã thanh toán | `paid=true` | HTTP 200; `paymentStatus = PAID`; giao dịch thanh toán `PAID`; có thông báo | | |
| TC-DM-23 | UC31 | Đơn `PAID` | Hoàn tác ghi nhận thanh toán | `paid=false` | HTTP 200; `paymentStatus = UNPAID`; giao dịch thanh toán `PENDING`, `paidAt = null` | | |
| TC-DM-24 | UC32 | Đã đăng nhập khách | Gọi `GET /api/admin/orders` bằng token khách | Bearer token của khách | HTTP 403 — quyền quản trị được kiểm soát ở server, không chỉ ẩn menu | | |
| TC-DM-25 | UC16 | Có đơn cũ `COMPLETED` chứa Phở bò và Bún chả | Bấm "Đặt lại" | — | Cả 2 món còn phục vụ được đưa về giỏ; món ngừng phục vụ bị bỏ qua kèm cảnh báo; **ghi chú cũ không** được mang theo | | |

## 2.3. Quản lý món và danh mục (UC26–UC28, UC27)

| ID | UC | Tiền điều kiện | Bước | Dữ liệu vào | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|----------------|------|-------------|-------------------|------------------|----------|
| TC-QM-01 | UC26 | Đã đăng nhập admin | Thêm món mới | `name: "Mì Quảng tôm"`, `categoryId: <Món Việt>`, `price: 75000`, `servingSize: 2`, `spicyLevel: 1`, `dietaryTags: ""`, `allergens: "hải sản"`, `ingredients: "mì, tôm, thịt lợn"`, `available: true` | HTTP 200; món hiện trong `/admin/foods` và trên trang thực đơn `/`; chi tiết món hiện đúng giá, khẩu phần, độ cay, dị ứng | | |
| TC-QM-02 | UC26 | — | Thêm món với giá bằng 0 hoặc âm | `price: 0` | HTTP 400 — giá phải lớn hơn 0 | | |
| TC-QM-03 | UC26 | — | Thêm món với danh mục không tồn tại | `categoryId: 999999` | HTTP 400, message "Danh mục không tồn tại" | | |
| TC-QM-04 | UC26 | Đã đăng nhập admin | Sửa giá và mô tả món "Cà phê sữa đá" | `price: 32000`, `description: "Cà phê phin đậm hơn"` | HTTP 200; giá mới hiện trên thẻ món và trong chi tiết món | | |
| TC-QM-05 | UC26 | Món **đã có trong đơn** (Phở bò) | Bấm "Xoá" | `DELETE /api/admin/foods/{id}` | HTTP 409, message gợi ý chuyển sang ngừng phục vụ; món vẫn còn trong CSDL | | |
| TC-QM-06 | UC26 | Món **đang nằm trong giỏ** của khách | Bấm "Xoá" | `DELETE /api/admin/foods/{id}` | HTTP 409, message gợi ý chuyển sang ngừng phục vụ | | |
| TC-QM-07 | UC26 | Món mới tạo, chưa dùng ở đâu | Bấm "Xoá" | `DELETE /api/admin/foods/{id}` | HTTP 200; món biến mất khỏi `/admin/foods` và khỏi trang thực đơn | | |
| TC-QM-08 | UC26 | Có món đang phục vụ | Chuyển món sang `available = false` | `available: false` | HTTP 200; nút "Thêm vào giỏ" của món đó hiện "Hết món" và bị vô hiệu hoá; chatbot không gợi ý món này | | |
| TC-QM-09 | UC27 | Đã đăng nhập admin, trong form món | Bấm "Tải ảnh lên" chọn ảnh JPG/PNG/WEBP hợp lệ | file ảnh ≤ 2 MB | HTTP 200, trả URL tuyệt đối trỏ vào `/api/uploads/**`; ảnh hiển thị trong ô xem trước và trên trang thực đơn | | |
| TC-QM-10 | UC27 | — | Tải file không phải ảnh nhưng khai `Content-Type: image/png` | file `.txt` | HTTP 400 — định dạng xác định bằng chữ ký đầu file, không tin `Content-Type` | | |
| TC-QM-11 | UC27 | — | Tải ảnh vượt quá 2 MB | file ảnh 3 MB | HTTP 400, message nêu giới hạn dung lượng | | |
| TC-QM-12 | UC28 | Đã đăng nhập admin | Thêm danh mục mới | `name: "Món Nhật"`, `slug: "mon-nhat"`, `description: "Sushi, ramen..."` | HTTP 200; danh mục hiện trên rail bên trái trang `/` và trong danh sách `/admin/categories` | | |
| TC-QM-13 | UC28 | — | Thêm danh mục trùng tên | `name: "Món Việt"` | HTTP 400 — tên danh mục phải duy nhất | | |
| TC-QM-14 | UC28 | Danh mục "Món Việt" còn món | Bấm "Xoá" | `DELETE /api/admin/categories/{id}` | HTTP 409, message "Danh mục còn chứa món ăn, không thể xóa" | | |
| TC-QM-15 | UC28 | Danh mục mới, rỗng | Bấm "Xoá" | `DELETE /api/admin/categories/{id}` | HTTP 200; danh mục biến mất khỏi rail | | |
| TC-QM-16 | UC07 | Đã đăng nhập admin | Duyệt thực đơn `/` rồi lọc theo tên, loại và khoảng giá | `category=Món Việt`, `keyword=bún`, `min=50000`, `max=100000` | Chỉ hiện món thuộc "Món Việt", tên chứa "bún", giá trong 50.000–100.000đ; bộ lọc nằm trên URL, chia sẻ link là giữ nguyên bộ lọc | | |

## 2.4. Chatbot tư vấn món ăn (UC21 → UC22–UC25)

> **Điều kiện chung:** `AI_API_KEY` phải là khóa hợp lệ. Nếu khóa sai hoặc hết hạn, mọi câu hỏi
> đều trả thông báo dự phòng và **không có thẻ món nào** — đây là hành vi dự phòng được thiết kế,
> không phải lỗi. Trong trường hợp đó ghi *Kết quả thực tế* là "Blocked — thiếu AI_API_KEY hợp lệ".
>
> **Cột quan trọng nhất của bảng này là "Kết quả mong đợi"**: nó thể hiện đúng điều mà đề tài
> yêu cầu — *AI không được bịa món, bịa giá hay bịa tình trạng phục vụ*.

| ID | UC | Tiền điều kiện | Bước | Dữ liệu vào (câu hỏi) | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|----------------|------|-----------------------|-------------------|------------------|----------|
| TC-CB-01 | UC21 | AI_API_KEY hợp lệ | Hỏi trong cửa sổ chatbot | "Tôi muốn ăn món Việt, không cay, khoảng 100.000 đồng" | Chỉ gợi ý món thuộc danh mục **Món Việt**, `spicyLevel = 0`, giá **một phần** ≤ 100.000đ (vd Phở bò 65.000đ, Bún chả 60.000đ, Cơm gà 55.000đ). Không gợi ý Bún bò Huế (cay 3) | | |
| TC-CB-02 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Gợi ý món ăn cho 4 người" | Mọi món gợi ý có `portions` và `totalPrice`; `portions = ceil(4 / khẩu phần món)`. Với món khẩu phần 1 → `portions = 4`; khẩu phần 2 → `portions = 2`; khẩu phần 4 → `portions = 1`. `totalPrice = giá × portions` | | |
| TC-CB-03 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Tôi không ăn cay và không thích hải sản, có món gì phù hợp?" | Mọi món gợi ý có `spicyLevel = 0` và **không** chứa "hải sản" trong cả trường dị ứng lẫn thành phần (loại trừ Gỏi cuốn, Canh chua cá lóc, Lẩu thái hải sản) | | |
| TC-CB-04 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Món nào dưới 150.000 đồng cho 2 người?" | Tổng tiền của **mọi** món gợi ý ≤ 150.000đ tính theo số phần (giá × portions), không so giá một phần | | |
| TC-CB-05 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Tôi muốn một món chính và một món uống khoảng 150.000 đồng" | Trả về **2** món: 1 món thuộc danh mục món chính (Món Việt / Món Âu / Món chay) và 1 món thuộc **Đồ uống**; tổng tiền ≤ 150.000đ | | |
| TC-CB-06 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Gợi ý món chay không cay" | Mọi món gợi ý có nhãn "chay" trong `dietaryTags` (vd Rau muống 35.000đ, Đậu hũ 40.000đ) và `spicyLevel = 0`; không gợi ý món có thịt | | |
| TC-CB-07 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Món nào chứa đậu nành?" | Gợi ý Đậu hũ sốt cà chua (40.000đ, dị ứng "đậu nành"); **không** gợi ý các món không chứa đậu nành | | |
| TC-CB-08 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Tôi dị ứng hải sản, có món nào an toàn không?" | Không món nào gợi ý chứa "hải sản" ở trường dị ứng hoặc thành phần; câu trả lời nói rõ không nên tự quyết định nếu chưa rõ | | |
| TC-CB-09 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Món nào ngon nhất?" | Có gợi ý món từ thực đơn thật (không bịa tên món không có trong CSDL); câu trả lời không khẳng định "món ngon nhất" như một sự thật khách quan | | |
| TC-CB-10 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Nhà hàng mở cửa lúc mấy giờ?" | Câu trả lời lấy từ tài liệu tham khảo đã nạp (giờ mở cửa 10:00–22:00); nếu tài liệu không có thì nói không rõ, **không** bịa giờ mở cửa | | |
| TC-CB-11 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Phí giao hàng là bao nhiêu?" | **Không** bịa phí giao hàng. Do hệ thống không tính phí giao hàng, câu trả lời phải nói rõ không có phí giao hàng / không áp dụng, tuyệt đối không nêu một con số tiền khác | | |
| TC-CB-12 | UC21 | AI_API_KEY hợp lệ | Hỏi ngoài lề thực đơn | "Ai là tổng thống Việt Nam?" hoặc "Bạn có thể lập trình Java không?" | Chatbot từ chối lịch sự và mời hỏi về món ăn/thực đơn/đặt món; **không** gợi ý món nào cho câu hỏi ngoài phạm vi | | |
| TC-CB-13 | UC21 | AI_API_KEY hợp lệ, có món đặt `available = false` | Hỏi về món vừa ngừng phục vụ | "Gợi ý món nào đang phục vụ?" | Món đã ngừng phục vụ **không** xuất hiện trong danh sách gợi ý; chatbot không nói món đó đang có sẵn | | |
| TC-CB-14 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Cho tôi một món ngoài thực đơn của nhà hàng" | Chatbot nói rõ nhà hàng chỉ phục vụ các món trong thực đơn, **không** bịa ra món không có trong CSDL | | |
| TC-CB-15 | UC21 | AI_API_KEY hợp lệ | Hỏi | "Tôi muốn ăn món Việt, không cay, khoảng 150.000 đồng cho 2 người" (câu hỏi mẫu trong đề tài) | Câu trả lời nêu đúng loại món (Món Việt), không cay, ngân sách 150.000đ, 2 người; mọi thẻ món có giá khớp CSDL và tổng tiền ≤ 150.000đ | | |
| TC-CB-16 | UC21 | Không đăng nhập | Mở chatbot ở `/` và hỏi một câu bất kỳ | "Món chay nào ngon?" | Chatbot vẫn trả lời và gợi ý món (endpoint công khai); nhưng **không** ghi vào lịch sử hội thoại | | |
| TC-CB-17 | UC21 | Đã đăng nhập | Hỏi một câu, rồi hỏi tiếp câu liên quan | "Món Việt nào ngon?" → "Món đó ăn cay không?" | Lượt thứ hai dùng được ngữ cảnh lượt trước: trả lời về **món vừa gợi ý**, không hỏi lại từ đầu | | |
| TC-CB-18 | UC21 | Đã đăng nhập | Hỏi một câu | "Món chay dưới 100k" | Trả về đúng các món chay dưới 100.000đ (Rau muống 35.000đ, Đậu hũ 40.000đ, Trà đào 40.000đ, Nước cam 35.000đ); **không** có Cà phê sữa đá (30.000đ) dù rẻ hơn vì không phải món chay | | |
| TC-CB-19 | UC35 | Đã đăng nhập admin | Mở `/admin/chatbot`, xem lịch sử hội thoại | — | Hiện đủ các lượt hỏi–đáp của khách đã đăng nhập, kèm thời gian và `sessionId`; tin nhắn của khách vãng lai **không** có trong danh sách | | |
| TC-CB-20 | UC21 | AI_API_KEY sai hoặc hết hạn | Hỏi một câu bất kỳ | "Món nào ngon?" | Chatbot trả thông báo dự phòng ngắn gọn, **không** gợi ý món giả; ứng dụng không bị treo hay báo lỗi 500 | | |

## 2.5. Kiểm thử tự động (mục 3.8 — kịch bản chạy bằng máy)

| ID | UC | Lệnh | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|------|-------------------|------------------|----------|
| TC-AU-01 | UC23 | `cd server && mvn test -Dtest=ChatbotServiceTest` | 5 test Pass: số phần theo khẩu phần, kết hợp món, lọc theo khẩu vị, AI lỗi không gợi ý món, AI trả thêm trường lạ | | |
| TC-AU-02 | UC12 | `cd server && mvn test -Dtest=OrderDtosValidationTest` | 11 test Pass: whitelist `COD`/`QR`, chặn giá trị lạ, chặn ghi chú > 255 ký tự, chặn đơn không có món | | |
| TC-AU-03 | — | `cd server && mvn test` | `Tests run: 16, Failures: 0, Errors: 0`, `BUILD SUCCESS` | | |
| TC-AU-04 | — | `cd client && npm run typecheck` | Không có lỗi kiểu dữ liệu (exit code 0) | | |
| TC-AU-05 | — | `cd client && npm run build` | Build thành công, sinh `client/dist/` (exit code 0) | | |

## 2.6. Đánh giá kiểm thử (mục 3.9)

### 2.6.1. Bảng tổng hợp kết quả

| Nhóm chức năng | Số test case | Đạt | Không đạt | Bị chặn | Tỉ lệ đạt |
|-----------------|---------------|-----|-----------|----------|-----------|
| Đăng nhập và hồ sơ | 14 | | | | |
| Đặt món và thanh toán | 25 | | | | |
| Quản lý món và danh mục | 16 | | | | |
| Chatbot tư vấn | 20 | | | | |
| Kiểm thử tự động | 5 | | | | |
| **Tổng** | **80** | | | | |

### 2.6.2. Phân tích các lỗi phát hiện

*(điền sau khi chạy)*

| Mã lỗi | Test case liên quan | Mô tả | Mức độ | Hướng sửa |
|---------|---------------------|-------|--------|----------|
| | | | | |

### 2.6.3. Kết luận về mức độ đáp ứng mục tiêu

| Mục tiêu (mục 3.1) | Đạt / Không đạt | Căn cứ |
|-------------------|------------------|--------|
| MT1 — Đầy đủ chức năng cốt lõi | | |
| MT2 — Ổn định & xử lý lỗi | | |
| MT3 — Giao diện và trải nghiệm | | |
| MT4 — Chatbot không bịa thông tin | | |
| MT5 — Phân quyền đúng | | |
| MT6 — Dữ liệu mẫu & quy trình kiểm thử | | |

---

# Phần 3. Unit test mẫu cho bộ lọc món của chatbot

Bộ lọc món là phần **quan trọng nhất** của chatbot: tiêu chí do AI trích xuất phải được áp dụng
bằng **code xác định**, không phải bằng suy luận của AI. Test chạy ở mức service với repository
và `AiClient` giả lập nên **không cần database hay Docker**, chạy được trong vài giây.

Tệp: `server/src/test/java/com/foodordering/service/ChatbotServiceTest.java`

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
        KnowledgeService knowledgeService = mock(KnowledgeService.class);
        AiSettingRepository settingRepo = mock(AiSettingRepository.class);

        monChinh = new Category();
        monChinh.setId(1L);
        monChinh.setName("Món Việt");
        doUong = new Category();
        doUong.setId(2L);
        doUong.setName("Đồ uống");

        when(categoryRepo.findAll()).thenReturn(List.of(monChinh, doUong));
        when(foodRepo.findAll()).thenAnswer(inv -> thucDong());
        when(knowledgeService.findRelevant(anyString(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(List.of());
        when(settingRepo.findById(anyString())).thenReturn(Optional.empty());

        service = new ChatbotService(ai, foodRepo, categoryRepo, chatRepo, userRepo,
                knowledgeService, settingRepo);
    }

    @Test
    @DisplayName("Tư vấn theo số người: số phần tính theo khẩu phần, tổng tiền nằm trong ngân sách")
    void tuVanTheoSoNguoi() {
        // 2 người, ngân sách 200k: món phục vụ 1 người cần 2 phần nên giá x2.
        mockExtract("""
                {"categories":[{"name":"Món Việt","count":1}],
                 "maxSpicyLevel":null,"maxBudget":200000,"people":2,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món ngon dưới 200k cho 2 người", "s1"));

        assertThat(res.foods()).isNotEmpty();
        // Phở bò 65k, khẩu phần 1 người -> 2 phần = 130k
        FoodCard pho = res.foods().stream().filter(c -> c.name().equals("Phở bò")).findFirst().orElseThrow();
        assertThat(pho.portions()).isEqualTo(2);
        assertThat(pho.totalPrice()).isEqualTo("130000");
        // Mọi món gợi ý đều phải vừa ngân sách tính theo số phần
        assertThat(res.foods()).allSatisfy(c -> {
            assertThat(Long.parseLong(c.totalPrice())).isLessThanOrEqualTo(200000L);
            assertThat(c.portions()).isGreaterThanOrEqualTo(1);
        });
    }

    @Test
    @DisplayName("Tư vấn kết hợp món: mỗi loại một món và tổng tiền không vượt ngân sách")
    void tuVanKetHopMon() {
        // 1 món chính + 1 món uống, tổng 150k.
        mockExtract("""
                {"categories":[{"name":"Món Việt","count":1},{"name":"Đồ uống","count":1}],
                 "maxSpicyLevel":null,"maxBudget":150000,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("1 món chính và 1 món uống khoảng 150k", "s2"));

        assertThat(res.foods()).hasSize(2);
        long tong = res.foods().stream().mapToLong(c -> Long.parseLong(c.totalPrice())).sum();
        assertThat(tong).isLessThanOrEqualTo(150000L);
        // Mỗi món phải đúng loại khách yêu cầu
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
    @DisplayName("AI lỗi hoặc trả JSON sai thì không gợi ý món thay vì bịa ra món")
    void aiLoiKhongGoiYMon() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));

        ChatResponse res = service.chat(null, new ChatRequest("món nào ngon?", "s4"));

        assertThat(res.foods()).isEmpty();
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

    /** Mock lần gọi AI đầu tiên (trích tiêu chí) trả về JSON, các lần sau trả về câu trả lời. */
    private void mockExtract(String json) {
        when(ai.generate(anyString(), anyString(), anyBoolean()))
                .thenAnswer(inv -> inv.getArgument(2, Boolean.class) ? json : "Dưới đây là gợi ý của mình.");
    }

    /** Dữ liệu món giống hệt phần seed trong DataSeeder để số liệu kiểm thử khớp thực tế. */
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

**Chạy riêng bộ test này:**

```bash
cd server
mvn test -Dtest=ChatbotServiceTest
```

**Ý nghĩa từng test** đối chiếu với bảng test case ở mục 2.4:

| Test | Kết quả mong đợi | Test case tương ứng |
|------|-----------------|----------------------|
| `tuVanTheoSoNguoi` | Số phần = `ceil(người ăn / khẩu phần)`, tổng tiền theo số phần nằm trong ngân sách | TC-CB-02, TC-CB-04 |
| `tuVanKetHopMon` | "1 món chính + 1 món uống" trả đúng 2 món đúng loại, tổng ≤ ngân sách | TC-CB-05 |
| `tuVanTheoKhauVi` | Chỉ món không cay, không chứa thành phần bị loại trừ | TC-CB-03, TC-CB-08 |
| `aiLoiKhongGoiYMon` | AI lỗi → **không** gợi ý món nào (không bịa) | TC-CB-20, RB13 |
| `aiTraThemTruongLa` | AI trả JSON có trường lạ vẫn dùng được tiêu chí | RB13 (mapper bỏ qua trường lạ) |

---

# Phần 4. Dữ liệu mẫu tham chiếu

## 4.1. Danh mục và món ăn do `DataSeeder` nạp

| Danh mục | Món | Giá | Khẩu phần | Cay (0–3) | Nhãn chế độ ăn | Dị ứng |
|----------|-----|-----|-----------|-----------|----------------|---------|
| Món Việt | Phở bò | 65.000 | 1 | 0 | – | gluten |
| Món Việt | Bún chả Hà Nội | 60.000 | 1 | 0 | – | – |
| Món Việt | Cơm gà xối mỡ | 55.000 | 1 | 0 | – | – |
| Món Việt | Bún bò Huế | 70.000 | 1 | 3 | – | gluten |
| Món Việt | Gỏi cuốn tôm thịt | 45.000 | 2 | 0 | – | hải sản, đậu phộng |
| Món Việt | Canh chua cá lóc | 90.000 | 3 | 1 | ít dầu mỡ | hải sản |
| Món Việt | Lẩu thái hải sản | 250.000 | 4 | 3 | – | hải sản |
| Món Việt | Bò lúc lắc | 120.000 | 2 | 0 | – | – |
| Món Âu | Mỳ Ý sốt bò bằm | 85.000 | 1 | 0 | – | gluten |
| Món Âu | Salad Caesar | 75.000 | 1 | 0 | ít dầu mỡ | sữa, trứng |
| Đồ uống | Trà đào cam sả | 40.000 | 1 | 0 | chay | – |
| Đồ uống | Nước cam ép | 35.000 | 1 | 0 | chay, ít dầu mỡ | – |
| Đồ uống | Cà phê sữa đá | 30.000 | 1 | 0 | – | sữa |
| Tráng miệng | Chè khúc bạch | 45.000 | 1 | 0 | chay | sữa, hạt |
| Món chay | Rau muống xào tỏi | 35.000 | 2 | 0 | chay, ít dầu mỡ | – |
| Món chay | Đậu hũ sốt cà chua | 40.000 | 2 | 0 | chay | đậu nành |

Ngoài ra hệ thống còn có: 2 tài khoản demo, 3 đơn mẫu (một đơn `COMPLETED` đã thanh toán, một
đơn `PREPARING`, một đơn `PENDING`), 2 đánh giá, 1 tài liệu tham khảo
(`quy-dinh-phuc-vu.txt`) và 3 khoá cấu hình chatbot (`max_suggestions`, `provider`, `model`).

## 4.2. Ràng buộc nghiệp vụ đã kiểm chứng

| Ràng buộc | Cách kiểm | Test case |
|-----------|-----------|-----------|
| Mật khẩu ≥ 8 ký tự | `POST /api/auth/register` với mật khẩu 7 ký tự trả 400 | TC-DN-09 |
| Số điện thoại đúng 10 chữ số | `POST /api/auth/register` với `phone: "123"` trả 400 | TC-DN-10 |
| `/api/auth/me` và `/api/auth/password` yêu cầu đăng nhập | gọi không header trả 401 | TC-DN-04 |
| Món ngừng phục vụ không thêm được vào giỏ | `POST /api/cart/items` trả 400 | TC-DM-03 |
| Món đã có trong đơn không xoá được | `DELETE /api/admin/foods/{id}` trả 409 kèm gợi ý ngừng phục vụ | TC-QM-05 |
| Danh mục còn chứa món không xoá được | `DELETE /api/admin/categories/{id}` trả 409 | TC-QM-14 |
| Không khoá/xoá được tài khoản quản trị | `PATCH /api/admin/users/{id}/active` trả 400 | — |
| Trạng thái đơn đi đúng một chiều | `PATCH /api/admin/orders/{id}/status` nhảy cóc trả 400 | TC-DM-20, TC-DM-21 |
| Khách chỉ hủy được đơn của mình còn chờ xác nhận | `PATCH /api/orders/{id}/cancel`, hủy lần hai trả 400 | TC-DM-15, TC-DM-16 |
| Khách không thao tác được đơn người khác | dùng token khách gọi `/api/admin/orders/**` trả 403 | TC-DM-24 |
| Chỉ khách đã đăng nhập mới lưu lịch sử chat | `GET /api/admin/chatbot/history` không có tin nhắn `user = null` | TC-CB-16, TC-CB-19 |
| Tài liệu rỗng hoặc PDF scan bị từ chối | `POST /api/admin/chatbot/documents` trả 400 | — |
| Ảnh sai định dạng bị từ chối dù khai Content-Type hợp lệ | `POST /api/admin/uploads/image` trả 400 | TC-QM-10 |
| Sửa/xoá đánh giá chỉ của chính mình | `PUT`/`DELETE /api/reviews/{id}` trả 403 với đánh giá người khác | — |
| Phương thức thanh toán thuộc whitelist | `POST /api/orders` với `paymentMethod` lạ trả 400 | TC-DM-10 |
| Mã QR chỉ hiện với phương thức `QR` | mở modal thanh toán của đơn `COD` không thấy mã QR | TC-DM-18 |

---

# Phần 5. Lỗi đã biết và ghi chú vận hành

## 5.1. Lỗi đã biết

| # | Lỗi / hạn chế | Tình trạng |
|---|----------------|-----------|
| L1 | Chưa kiểm chứng trực quan trên màn hình 390px (iPhone) — bộ công cụ không đổi được kích thước cửa sổ. Các thay đổi dùng breakpoint sẵn có của Tailwind nên rủi ro thấp, nhưng nên mở bằng thiết bị thật một lượt trước khi nộp | Chưa kiểm |
| L2 | Luồng chatbot **thành công** (AI thật trả lời kèm danh sách món khớp câu hỏi) chưa kiểm chứng được khi `AI_API_KEY` trong `.env` không hợp lệ | Chờ khóa hợp lệ |
| L3 | Chưa có test tự động phía client (Vitest) và chưa có E2E (Playwright) | Kế hoạch |

## 5.2. Ghi chú vận hành

- **Dữ liệu demo được seed khi bảng `users` còn trống**; lần khởi động sau sẽ bỏ qua toàn bộ seed
  nên không nhân đôi dữ liệu demo. Muốn nạp lại từ đầu: xoá volume rồi dựng lại stack
  (`docker compose --profile prod down -v` rồi `up`).
- **Tài khoản demo**: `admin@demo.com` / `admin123` (quản trị), `user@demo.com` / `user1234` (khách).
  Cơ sở dữ liệu đã seed từ trước vẫn giữ mật khẩu cũ.
- Nếu `AI_API_KEY` sai hoặc hết hạn, chatbot trả thông báo dự phòng kèm thẻ món lọc được.
  Đây là hành vi dự kiến, không phải lỗi; luồng lọc món vẫn chạy bằng code xác định.
- **Không có script nạp dữ liệu mẫu bằng tay**: toàn bộ dữ liệu mẫu do `DataSeeder` tạo, nhằm
  tránh tình trạng dữ liệu trong CSDL lệch với dữ liệu mẫu mô tả trong tài liệu.
- `mvn test` hiện chạy **16 test** và không cần Docker; đây là bằng chứng tự động duy nhất,
  không thay thế cho kiểm thử thủ công theo các bảng ở Phần 2.
