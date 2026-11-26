Khu quản trị nằm dưới `/admin/*`, dùng `client/src/layouts/AdminLayout.vue`.

- Menu trái 4 nhóm, 8 mục: Bán hàng (Tổng quan, Đơn hàng, Khách hàng), Thực đơn (Món ăn, Danh mục), Marketing (Khuyến mãi), Hệ thống (Chatbot, Báo cáo).
- Không có khung chatbot ở khu quản trị.
- Toàn bộ `/api/admin/**` được bảo vệ bằng `requireRole("ADMIN")` ở `server/src/admin/routes.ts`.
- Giao diện dùng palette orange riêng khai báo ở `client/src/shared/theme.ts`.

Router guard ở `client/src/router/index.ts` chỉ là UX; quyền thật do server kiểm tra.

## 1. Tổng quan

- Trang: `client/src/admin/dashboard/pages/AdminDashboardPage.vue`.
- Dữ liệu lấy từ các endpoint báo cáo và danh sách đơn.
- Hiển thị doanh thu, đơn chờ, món bán chạy.

## 2. Món ăn và danh mục

- Trang: `client/src/admin/menu/pages/AdminFoodsPage.vue`, `AdminCategoriesPage.vue`.
- API: `POST/PUT/DELETE /api/admin/foods`, `/api/admin/categories`.
- Server: `server/src/admin/menu/routes.ts`, `service.ts`, `schema.ts`.

Món có các trường: tên, danh mục, mô tả, nguyên liệu, giá, khẩu phần, độ cay, nhãn chế độ ăn, dị ứng, ảnh, trạng thái còn bán.

Ảnh món:

- Tải file qua `POST /api/admin/uploads/image` (`server/src/admin/upload/routes.ts`).
- Chỉ nhận JPG/PNG/WEBP, tối đa 2 MB.
- Server kiểm chữ ký đầu file, không tin `Content-Type`.
- File lưu ở `UPLOAD_DIR` (volume `uploads`), phục vụ tại `/api/uploads/**`.
- Endpoint trả URL tuyệt đối. Có thể dán URL ngoài trong form.

Ảnh local trong seed nằm ở `client/public/images/foods/` và phải là `.webp`.

## 3. Đơn hàng

- Trang: `client/src/admin/order/pages/AdminOrdersPage.vue`.
- API: `server/src/admin/order/routes.ts`, `server/src/admin/payment/routes.ts`.
- Server: `server/src/admin/order/service.ts`.

Chức năng:

- `GET /api/admin/orders`: danh sách toàn bộ đơn.
- `POST /api/admin/orders`: tạo đơn hộ khách.
- `PUT /api/admin/orders/:id`: sửa đơn.
- `DELETE /api/admin/orders/:id`: xoá đơn.
- `PATCH /api/admin/orders/:id/status`: đổi trạng thái.
- `PATCH /api/admin/orders/:id/payment?paid=true|false`: đánh dấu đã/chưa thanh toán.

### Quy tắc sửa đơn

- Món chỉ sửa được khi đơn `PENDING` **và** `UNPAID` (`canEditItems` trong `server/src/user/order/transitions.ts`).
- Đơn `COMPLETED` hoặc `CANCELLED` khoá hoàn toàn, kể cả thông tin giao hàng.
- Các trạng thái còn lại chỉ sửa người nhận, số điện thoại, địa chỉ, ghi chú và trạng thái.
- `items: []` nghĩa là **không đổi món**, chỉ sửa thông tin giao hàng.
- Đổi món thì phải tính lại giá món cũ để trả `usedCount` cho khuyến mãi cũ, rồi mới đánh dấu khuyến mãi mới (`syncPromotionUsage`).

### Quy tắc tạo đơn

- Đơn mới luôn bắt đầu `PENDING`.
- Chỉ tạo được trạng thái đi tiếp được từ `PENDING`: `PENDING`, `CONFIRMED`, `CANCELLED` (`isCreatableStatus`).
- `CONFIRMED` + `QR` phải đã thu tiền.

### Trạng thái và thanh toán

- Khi cập nhật đơn, server áp `paid` **trước** rồi mới đổi trạng thái, để guard QR thấy trạng thái thanh toán mới.
- Nhãn `PREPARING` hiển thị là "Đang vận chuyển". Mã trong CSDL không đổi.
- Nút admin `CONFIRMED -> PREPARING` có nhãn "Giao hàng".

### Xoá đơn

Xoá trong một transaction gồm thông báo, giao dịch thanh toán, dòng món và đơn, để không còn dữ liệu móc.

## 4. Khách hàng

- Trang: `client/src/admin/customer/pages/AdminCustomersPage.vue`.
- API: `server/src/admin/customer/routes.ts`, `service.ts`.

Chức năng: danh sách, tạo, sửa, xoá, khoá/mở khoá tài khoản.

Ràng buộc: không sửa, khoá hoặc xoá tài khoản quản trị.

Số điện thoại phải khớp `^0\d{9}$`.

## 5. Khuyến mãi

- Trang: `client/src/admin/promotion/pages/AdminPromotionsPage.vue`.
- API: `server/src/admin/promotion/routes.ts`, `service.ts`, `schema.ts`.
- Engine áp dụng: `server/src/user/pricing/engine.ts`.

Trường chính:

- `discountType`: `PERCENT` hoặc `FIXED`.
- `scope`: `GLOBAL`, `CATEGORY`, `FOOD`.
- `targetIds`: bắt buộc khi scope là `CATEGORY`/`FOOD`; danh sách rỗng thì server trả 400 và client chặn trước khi gửi.
- `startsAt`, `endsAt`, `daysOfWeek`, `startTime`, `endTime`.
- `usageLimit`: `0` nghĩa là không giới hạn.
- `minOrderTotal`: tổng đơn tối thiểu để áp khuyến mãi. Trên thực đơn chưa có tổng đơn nên các khuyến mãi có hạn mức không hiện giảm.

Mỗi dòng chỉ nhận một khuyến mãi tự động tốt nhất.

## 6. Báo cáo

- Trang: `client/src/admin/report/pages/AdminReportsPage.vue`.
- API: `server/src/admin/report/routes.ts`, `service.ts`.
- Endpoint: `/api/admin/reports/summary`, `/revenue`, `/top-foods`, `/export`.

Ngày `from`/`to`:

- Client gửi chuỗi `"YYYY-MM-DD"` theo ngày đã chọn.
- Server đọc bằng `parseBusinessRange` (`server/src/lib/businessTime.ts`) theo ngày lịch Việt Nam.
- Bảng hiển thị bằng `dayLabel` để không lệch múi giờ máy.

`topFoods` gom theo `foodId`, nên hai món trùng tên vẫn là hai dòng khác nhau.

Xuất Excel trả file `.xlsx` từ `GET /api/admin/reports/export`.

## 7. Chatbot và tài liệu tri thức

- Trang: `client/src/admin/chatbot/pages/AdminChatbotPage.vue`.
- API: `server/src/admin/chatbot/routes.ts`, `service.ts`.
- Cấu hình: `GET/PUT /api/admin/chatbot/settings` cho `max_suggestions` và `extra_rules`.
- Tài liệu: danh sách, thống kê, xem chunk, sửa, xoá, tải lên, cập nhật (chia lại chunk và embed).
- Upload nhận PDF/DOCX/TXT/MD tối đa 10 MB, có progress bar phía client.
- Trang không còn xem lịch sử hội thoại của khách; lịch sử nằm ở `/api/chatbot/sessions/**` dành cho chính khách.

Nút **Cập nhật** chia lại chunk rồi embed lại. `GET /api/admin/chatbot/documents/stats` trả `totalDocuments`, `totalChunks`, `embeddedChunks`, `ready`, `failed`.

Embedding chỉ chạy khi provider dùng được; thiếu khoá thì chunk vẫn lưu nhưng thiếu vector.

Xem thêm [Chatbot](Luong-chatbot).
