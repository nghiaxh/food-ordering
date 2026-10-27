# Hướng dẫn chạy test

Tài liệu tổng hợp cách chạy test của dự án FoodOrdering theo từng tầng:
client (unit + type), server (unit + integration) và end-to-end.

> **Lưu ý:** dự án đang ở giai đoạn **scaffolding chưa có test nào**. Các bảng dưới là
> kế hoạch framework, cấu trúc và lệnh sẽ dùng; test thật được bổ sung khi triển khai
> code chi tiết trên branch `draft` / `feat/*`.

## Tổng quan

| Tầng | Framework dự kiến | Cần Docker | Lệnh |
|------|-------------------|:---:|------|
| Client (unit) | Vitest + @testing-library/react | Không | `npm test` |
| Client (type) | tsc | Không | `npm run typecheck` |
| Server (unit + integration) | JUnit 5 + Testcontainers | Có | `mvn test` |
| E2E | Playwright (Chromium) | Không (cần stack dev đang chạy) | `npm test` (trong `e2e/`) |

---

## 1. Client tests

Chạy trong `client/`:

```bash
npm run typecheck   # tsc --noEmit — kiểm tra type
npm test            # Vitest — chạy một lần
npm run dev         # dev server, http://localhost:5173
```

Cấu hình dự kiến: `vitest.config.ts` (jsdom hoặc happy-dom, globals). Không có linter.

### Unit test dự kiến (logic thuần)

| Khu vực | Nội dung |
|---------|----------|
| `store/cartStore` | Thêm/sửa/xóa/clear giỏ, tính tổng tiền |
| `store/authStore` | Lưu/khôi phục/đăng xuất phiên JWT |
| `api/http` | Gắn `Authorization: Bearer` từ localStorage, xử lý 401 |
| `components/ChatbotWidget` | Gửi tin, render thẻ món, trạng thái loading/lỗi |

---

## 2. Server tests

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
| TC-DN-15 | UC14 | Đã đăng nhập | Xem thanh điều hướng rồi bấm nút đơn hàng (icon `inbox`, cạnh nút giỏ hàng) | — | Thanh điều hướng hiện nút "Đơn hàng" cạnh nút giỏ hàng; bấm sang trang `/orders` | | |
| TC-DN-16 | UC14 | Chưa đăng nhập | Xem thanh điều hướng | — | Không có nút "Đơn hàng" trên thanh điều hướng (chỉ có nút giỏ hàng và ô "Đăng nhập") | | |
| TC-DN-17 | UC02 | — | Xem thanh điều hướng rồi bấm nút trang chủ (icon `home`), sau đó mở `/login` | — | Nút trang chủ đưa về `/`; trang `/login` và `/register` hiện logo FoodOrdering ở góc trên trái (hai trang không có thanh điều hướng) | | |

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
| TC-DM-15 | UC15 | Có đơn `PENDING` **và** `UNPAID` | Bấm "Hủy đơn" | — | HTTP 200; `status = CANCELLED`; có thông báo xác nhận hủy | | |
| TC-DM-16 | UC15 | Đơn đã `CANCELLED` | Bấm "Hủy đơn" lần nữa | — | HTTP 400, message "Chỉ đơn đang chờ xác nhận mới hủy được..." | | |
| TC-DM-17 | UC15 | Có đơn `PREPARING` | Gọi `PATCH /api/orders/{id}/cancel` | — | HTTP 400 — đơn đã vào chế biến không tự hủy được | | |
| TC-DM-18 | UC13 | Đơn `PENDING` chọn `paymentMethod = "QR"` | Mở modal thanh toán | — | Hiện mã QR quét được (mã hoá `FOOD-{id}-{tổng tiền}`) kèm cảnh báo "Thanh toán mô phỏng"; mã QR **không** hiện với phương thức COD | | |
| TC-DM-19 | UC30 | Đã đăng nhập admin, có đơn `PENDING` | Chuyển đơn sang "Đã xác nhận" | `status: "CONFIRMED"` | HTTP 200; `status = CONFIRMED`; khách nhận thông báo | | |
| TC-DM-20 | UC30 | Đơn `CONFIRMED` | Thử chuyển thẳng sang `COMPLETED` | `status: "COMPLETED"` | HTTP 400 — trạng thái đơn đi đúng một chiều, không nhảy cóc | | |
| TC-DM-21 | UC30 | Đơn `COMPLETED` | Thử chuyển trạng thái bất kỳ | `status: "PENDING"` | HTTP 400 — đơn đã chốt không đổi trạng thái được | | |
| TC-DM-22 | UC31 | Đã đăng nhập admin, đơn `UNPAID` | Ghi nhận đã thanh toán | `paid=true` | HTTP 200; `paymentStatus = PAID`; giao dịch thanh toán `PAID`; có thông báo | | |
| TC-DM-23 | UC31 | Đơn `PAID` | Hoàn tác ghi nhận thanh toán | `paid=false` | HTTP 200; `paymentStatus = UNPAID`; giao dịch thanh toán `PENDING`, `paidAt = null` | | |
| TC-DM-24 | UC32 | Đã đăng nhập khách | Gọi `GET /api/admin/orders` bằng token khách | Bearer token của khách | HTTP 403 — quyền quản trị được kiểm soát ở server, không chỉ ẩn menu | | |
| TC-DM-25 | UC16 | Có đơn cũ `COMPLETED` chứa Phở bò và Bún chả | Bấm "Đặt lại" | — | Cả 2 món còn phục vụ được đưa về giỏ; món ngừng phục vụ bị bỏ qua kèm cảnh báo; **ghi chú cũ không** được mang theo | | |
| TC-DM-26 | UC14 | Có đơn của chính mình | Xem `/orders`, sau đó mở `/admin/orders` | — | Mã đơn hiển thị giống nhau ở cả hai trang, dạng `FO-xxxx` (tiền tố `FO` + id đệm 4 chữ số) | | |
| TC-DM-27 | UC15 | Đơn `PENDING` đã `PAID` (khách đã bấm Thanh toán) | Gọi `PATCH /api/orders/{id}/cancel` | — | HTTP 400 — đơn đã thu tiền thì khách không tự hủy được; nút Hủy trên `/orders` cũng không còn | | |
| TC-DM-28 | UC15 | Đơn `CONFIRMED`, `UNPAID` | Gọi `PATCH /api/orders/{id}/cancel` | — | HTTP 400 — quán đã xác nhận thì không hủy từ phía khách | | |
| TC-DM-29 | UC12 | Đã đăng nhập, giỏ có Phở bò × 2 | Gọi `POST /api/cart/quote` (không mã) | `{}` | `subtotal = 130000`, `discountTotal = 0`, `total = 130000`; mỗi `line.lineDiscount` là tiền giảm của **cả dòng** | | |
| TC-DM-30 | UC12 | Trang chủ có mục "Combo tiết kiệm" | Thêm combo "Combo Phở bò + Trà đào" rồi báo giá | `POST /api/cart/items` với `comboId` | Dòng combo xuất hiện với `unitPrice` = giá combo trong DB (95.000đ), không phải tổng giá lẻ; đặt được đơn có `OrderItem.combo` | | |
| TC-DM-31 | UC12 | Chương trình "Cuối tuần mát lạnh" đang chạy, hôm nay là thứ Bảy | Báo giá một món uống | `POST /api/cart/quote` | Dòng đồ uống có `lineDiscount = 20%` giá món và `discountLabel = "Cuối tuần"`; món chính trong cùng giỏ không bị giảm | | |
| TC-DM-32 | UC12 | Chương trình "Món may mắn hôm nay" (`randomCount = 2`) | Báo giá toàn bộ thực đơn trong cùng ngày, rồi kiểm lại vào ngày khác | `GET /api/foods` | Đúng 2 món có `discountPercent = 15`; danh sách 2 món giữ nguyên trong ngày (băm theo `foodId`, `promotionId`, ngày) và đổi khi sang ngày mới | | |
| TC-DM-33 | UC12 | Voucher `WELCOME` (giảm 20.000đ, đơn từ 100.000đ) đã có trong ví | Báo giá giỏ 130.000đ kèm mã | `{"voucherCode":"WELCOME"}` | `discountTotal ≥ 20000`, `total = subtotal - discountTotal`, `voucherCode = "WELCOME"`; đơn tạo ra có `discountTotal`, `promotionCode`, và `OrderItem.discountAmount` cộng lại đúng bằng `discountTotal` | | |
| TC-DM-34 | UC12 | Voucher `WELCOME` chưa nhận vào ví | Báo giá kèm mã | `{"voucherCode":"WELCOME"}` | HTTP 400, message "Bạn chưa nhận voucher này"; giỏ không đổi | | |
| TC-DM-35 | UC12 | Voucher `WELCOME` đã dùng cho một đơn trước đó | Báo giá lại kèm mã | `{"voucherCode":"WELCOME"}` | HTTP 400, message "Voucher này đã được dùng" | | |
| TC-DM-36 | UC12 | Giỏ 50.000đ, voucher yêu cầu đơn từ 100.000đ | Báo giá kèm mã | `{"voucherCode":"WELCOME"}` | HTTP 400, message nêu đơn chưa đạt giá trị tối thiểu; tổng tiền không đổi | | |
| TC-DM-37 | UC12 | Voucher giảm 30.000đ cố định, giỏ có 2 dòng 20.000đ và 10.001đ | Báo giá kèm mã | — | Tổng giảm đúng 30.000đ (dòng đầu 19.999đ, dòng cuối 10.001đ), `total = 1`; không lệch đồng nào so với mệnh giá voucher | | |
| TC-DM-38 | UC12 | Đơn 10.001đ, voucher cố định 30.000đ | Báo giá kèm mã | — | Giảm tối đa bằng tổng đơn, `total = 0`, không bao giờ âm | | |
| TC-DM-39 | UC30 | Đơn `PENDING` + `UNPAID` | Admin sửa danh sách món | `PUT /api/admin/orders/{id}` kèm `items` | HTTP 200; dòng đơn và tổng tiền được tính lại, giao dịch thanh toán cập nhật số tiền | | |
| TC-DM-40 | UC30 | Đơn `PENDING` + `PAID` | Admin sửa danh sách món | `PUT /api/admin/orders/{id}` kèm `items` | HTTP 400, message "Chỉ sửa được món khi đơn đang chờ xác nhận và chưa thanh toán" | | |
| TC-DM-41 | UC30 | Đơn `PENDING` + `PAID` | Admin chỉ sửa người nhận, SĐT, địa chỉ, ghi chú (không gửi `items`) | `PUT /api/admin/orders/{id}` không có `items` | HTTP 200; thông tin giao hàng đổi, danh sách món và tổng tiền giữ nguyên | | |
| TC-DM-42 | UC30 | Đơn `COMPLETED` hoặc `CANCELLED` | Admin bấm Sửa hoặc gọi `PUT /api/admin/orders/{id}` | Bất kỳ | Nút Sửa bị vô hiệu hoá trên giao diện; gọi thẳng API trả HTTP 400 "Đơn đã ... nên không sửa được nữa" | | |
| TC-DM-43 | UC30 | Đã đăng nhập admin | Mở `/admin` | — | Chuyển tới `/admin/dashboard`; hàng chỉ số 30 ngày, danh sách đơn chờ có nút Xác nhận, món bán chạy dạng thanh một màu | | |
| TC-DM-44 | UC30 | Dashboard có đơn chờ | Bấm "Xác nhận" trên một đơn | — | HTTP 200; đơn chuyển `CONFIRMED`, biến khỏi danh sách chờ, số liệu tải lại | | |
| TC-DM-45 | UC12 | Tài khoản vừa đăng ký (đã có `WELCOME` trong ví) | Gọi `POST /api/promotions/lucky` (hiện chưa có nút trên giao diện sau khi bỏ khối ưu đãi ở trang chủ) | `POST /api/promotions/lucky` | HTTP 200, nhận thêm `LUCKY15` hoặc `HOLIDAY10`; gọi lần hai trong ngày trả 409 "Hôm nay bạn đã nhận quà rồi" — voucher chào mừng không bị tính là lượt bốc quà | | |
| TC-DM-46 | UC12 | Combo còn phục vụ | Bấm chip "Combo tiết kiệm" rồi bấm một thẻ combo | Mở `/combos/{id}` | Lưới đổi sang thẻ combo cùng khung thẻ món, hai hàng chip vẫn hiện đủ; dải giá lọc đúng combo (50–100k còn 6 combo, "Trên 150k" hiện thông báo trống); Drawer mở với bố cục giống chi tiết món (ảnh `2/1` trên desktop), giá, mô tả, số món, giá gọi riêng, tiết kiệm, danh sách món kèm giá, hàng số lượng + tổng tiền + "Thêm vào giỏ"; đóng panel quay về bảng món | | |

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
| TC-CB-20 | UC21 | AI_API_KEY sai hoặc hết hạn | Hỏi một câu bất kỳ | "Món nào ngon?" | Ứng dụng không bị treo hay báo lỗi 500; câu trả lời do server dựng theo mẫu dự phòng (không phải nội dung AI) và mọi thẻ món gợi ý đều là món thật lấy từ CSDL, **không** có món giả | | |
| TC-CB-21 | UC21 | AI_API_KEY thiếu hoặc hỏng | Hỏi về khẩu vị | "Gợi ý món chay không cay" | Nhánh dự phòng lọc món bằng code: chỉ trả món **chay** và **không cay** (Rau muống 35.000đ, Đậu hũ 40.000đ, Nước cam 35.000đ, Trà đào 40.000đ, Chè khúc bạch 45.000đ), không có món cay. Câu trả lời chỉ tóm tắt ("Mình tìm được 5 món chay, không cay, giá từ 35.000đ.") và mời bấm thẻ món, **không** liệt kê lại danh sách món | | |
| TC-CB-22 | UC21 | AI_API_KEY thiếu hoặc hỏng | Hỏi ngoài lề | "Ai là Tổng thống Việt Nam?" | Chatbot **không** gợi ý món nào (câu hỏi không có từ khoá món), chỉ nhắc tư vấn về món ăn của quán | | |
| TC-CB-23 | UC21 | AI_API_KEY thiếu hoặc hỏng | Hỏi kèm ngân sách và số người | "Món ngon dưới 200k cho 2 người" | Nhánh dự phòng áp đúng số phần và tổng tiền: tổng tiền mỗi thẻ = giá × số phần và **không** vượt 200.000đ | | |
| TC-CB-24 | UC21 | AI_API_KEY thiếu hoặc hỏng | Hỏi về quy định phục vụ | "Giờ mở cửa mấy giờ?" | Không gợi ý món nào; câu trả lời trích đúng dòng tài liệu có từ khoá ("Giờ mở cửa: 10:00 đến 22:00..."), không lẫn tiêu đề tài liệu hay đoạn text bị cắt dở | | |

## 2.5. Kiểm thử tự động (mục 3.8 — kịch bản chạy bằng máy)

| ID | UC | Lệnh | Kết quả mong đợi | Kết quả thực tế | Pass/Fail |
|----|----|------|-------------------|------------------|----------|
| TC-AU-01 | UC23 | `cd server && mvn test -Dtest=ChatbotServiceTest` | 7 test Pass: số phần theo khẩu phần, kết hợp món, lọc theo khẩu vị, AI lỗi rơi sang nhánh dự phòng, AI lỗi + câu hỏi ngoài lề không gợi ý món, AI lỗi + câu hỏi trong tài liệu trích đúng dòng, AI trả thêm trường lạ | | |
| TC-AU-02 | UC12 | `cd server && mvn test -Dtest=OrderDtosValidationTest` | 11 test Pass: whitelist `COD`/`QR`, chặn giá trị lạ, chặn ghi chú > 255 ký tự, chặn đơn không có món | | |
| TC-AU-03 | — | `cd server && mvn test` | `Tests run: 24, Failures: 0, Errors: 0`, `BUILD SUCCESS` | | |
| TC-AU-04 | — | `cd client && npm run typecheck` | Không có lỗi kiểu dữ liệu (exit code 0) | | |
| TC-AU-05 | — | `cd client && npm run build` | Build thành công, sinh `client/dist/` (exit code 0) | | |
| TC-AU-06 | UC12 | `cd server && mvn test -Dtest=PricingServiceTest` | 7 test Pass: giảm % theo từng dòng, chỉ chọn chương trình tốt nhất, voucher cố định chia đúng tổng tiền, voucher lớn hơn đơn không làm tổng âm, chặn đơn dưới mức tối thiểu, chặn voucher chưa nhận, khuyến mãi theo danh mục bỏ qua món ngoài phạm vi | | |

## 2.6. Đánh giá kiểm thử (mục 3.9)

### 2.6.1. Bảng tổng hợp kết quả

| Nhóm chức năng | Số test case | Đạt | Không đạt | Bị chặn | Tỉ lệ đạt |
|-----------------|---------------|-----|-----------|----------|-----------|
| Đăng nhập và hồ sơ | 14 | | | | |
| Đặt món và thanh toán | 45 | | | | |
| Quản lý món và danh mục | 16 | | | | |
| Chatbot tư vấn | 20 | | | | |
| Kiểm thử tự động | 6 | | | | |
| **Tổng** | **102** | | | | |

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
mvn test      # unit + integration
```

### Unit test dự kiến (mock bean)

| Service | Nội dung |
|---------|----------|
| `AuthService` | Register (trùng email), login (sai mật khẩu, tài khoản bị khóa) |
| `FoodService` | Tìm kiếm/lọc theo từ khóa, danh mục, khoảng giá, available |
| `OrderService` | Tạo đơn, giá lấy từ DB, món ngừng phục vụ |
| `ChatbotService` | Trích xuất tiêu chí, lọc món theo cay/dị ứng/ngân sách |
| `AiClient` | Map response Gemini thành text (mock HTTP) |
| `KnowledgeService` | Tách đoạn, chấm điểm theo từ khóa |

---

## 3. E2E tests (Playwright)

Chạy trong `e2e/` — yêu cầu stack dev đang chạy tại `http://localhost:5173`:

```bash
docker compose --profile dev up --build   # từ repo root, chạy stack dev
npm install                               # (e2e/) lần đầu
npm test                                  # headless, chromium
```

Ngoài ra hệ thống còn có: 7 combo ("Combo Phở bò + Trà đào" 95.000đ, "Combo Cơm gà + Nước cam"
80.000đ, "Combo Bún chả + Cà phê sữa" 79.000đ, "Combo Bún bò Huế + Trà đào" 97.000đ,
"Combo Mỳ Ý + Nước cam" 105.000đ, "Combo Cơm gà + Trà đào" 84.000đ, "Combo chay thanh đạm"
99.000đ), 3 voucher nhận vào ví (`WELCOME` giảm 20.000đ cho đơn từ 100.000đ, `LUCKY15` giảm 15%
tối đa 40.000đ, `HOLIDAY10` giảm 10% tối đa 50.000đ), 2 chương trình tự động ("Cuối tuần mát
lạnh" giảm 20% đồ uống thứ Bảy/Chủ Nhật và "Món may mắn hôm nay" giảm 15% cho 2 món ngẫu nhiên
mỗi ngày), 2 tài khoản demo (khách demo đã có sẵn `WELCOME` trong ví), 3 đơn mẫu (một đơn
`COMPLETED` đã thanh toán, một đơn `PREPARING`, một đơn `PENDING`), 2 đánh giá và 3 khoá cấu hình
chatbot (`max_suggestions`, `provider`, `model`).

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
| Đơn đã thanh toán hoặc đã xác nhận thì khách không hủy được | `PATCH /api/orders/{id}/cancel` trả 400 | TC-DM-27, TC-DM-28 |
| Admin chỉ sửa món khi đơn `PENDING` + `UNPAID` | `PUT /api/admin/orders/{id}` kèm `items` trả 400 sau khi thu tiền | TC-DM-39, TC-DM-40 |
| Đơn `COMPLETED`/`CANCELLED` khoá hoàn toàn | `PUT /api/admin/orders/{id}` trả 400 | TC-DM-42 |
| Voucher phải có trong ví và chưa dùng | `POST /api/cart/quote` với mã chưa nhận/đã dùng trả 400 | TC-DM-34, TC-DM-35 |
| Giảm giá không làm tổng đơn âm và không lệch đồng nào | ca test `PricingServiceTest`, báo giá với voucher lớn hơn đơn | TC-AU-06, TC-DM-37, TC-DM-38 |

---

## Ghi chú

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
- `mvn test` hiện chạy **24 test** và không cần Docker; đây là bằng chứng tự động duy nhất,
  không thay thế cho kiểm thử thủ công theo các bảng ở Phần 2.
