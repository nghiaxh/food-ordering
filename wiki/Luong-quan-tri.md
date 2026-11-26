# Luồng quản trị

Trang này đi theo các việc admin làm được và các ràng buộc chặn sai sót. Quyền `ADMIN` được kiểm ở `server/src/admin/routes.ts:15` bằng `requireRole(\"ADMIN\")` trên cả cây `/api/admin`.

## Trải nghiệm trên màn hình

- `/admin` là `AdminLayout`: menu trái 4 nhóm / 8 mục, không có khung chatbot.
- Các trang: dashboard, món ăn, danh mục, đơn hàng, khách hàng, khuyến mãi, báo cáo, tài liệu chatbot.
- Màu accent trong khu quản trị dùng class `orange-*`, không dùng `amber-*`.

## Quản lý món và danh mục

Endpoint ở `server/src/admin/menu/routes.ts`. Admin thêm/sửa/xoá món, đổi `available`, tải ảnh lên `POST /api/admin/uploads/image` (JPG/PNG/WEBP, ≤ 2 MB, kiểm bằng chữ ký đầu file) hoặc dán URL ngoài.

Ảnh lưu ở `UPLOAD_DIR` (volume `uploads`) và phục vụ tại `/api/uploads/**`. Endpoint trả URL tuyệt đối.

Dữ liệu ảnh seed dùng file local dưới `client/public/images/foods/`. Đổi định dạng phải sửa `server/src/db/seed.ts` và chạy `UPDATE` cho DB cũ.

## Duyệt và sửa đơn

Xem [Đặt món và thanh toán](Luong-dat-mon) cho luật trạng thái. Admin có thêm:

- `adminUpdateStatus(id, status)` (`server/src/admin/order/service.ts:43-70`): chuyển trạng thái một chiều và gửi thông báo theo trạng thái.
- `adminUpdateOrder` (`service.ts:145-264`): áp `paid` **trước** khi đổi trạng thái để guard QR thấy trạng thái thanh toán mới.
- `adminDeleteOrder` (`service.ts:265-276`): xoá trong transaction.

## Khách hàng

`/api/admin/customers/**`: xem danh sách, khoá/mở tài khoản, reset mật khẩu. Không sửa/khoá/xoá tài khoản quản trị. Xem `server/src/admin/customer/service.ts`.

## Khuyến mãi

Schema ở `server/src/admin/promotion/schema.ts`. Ràng buộc:

- Phạm vi `CATEGORY`/`FOOD` **phải** có `targetIds`; danh sách rỗng thì KM không khớp món nào, server trả 400 và client chặn trước khi gửi (`schema.ts:33-43`).
- `usageLimit` bằng `0` nghĩa là **không giới hạn** (lưu `null`).
- `minOrderTotal` là hạn mức tổng đơn tối thiểu; engine `user/pricing` chỉ áp KM khi tổng đơn đạt mức (`minOrderReached`), nên trên thực đơn các KM có hạn mức không hiện giảm.

## Báo cáo

`/api/admin/reports/**`: doanh thu, top món, phân bố trạng thái. Dùng `parseBusinessRange` (`server/src/lib/businessTime.ts`) nên ngày theo lịch Việt. `topFoods` gom theo `foodId`, nên hai món trùng tên vẫn là hai món khác nhau.

Xuất Excel ở client từ dữ liệu API.

## Tài liệu chatbot

Trang `/admin/chatbot` chỉ có bảng tài liệu 4 cột: tiêu đề, nhóm, trạng thái, thao tác (Sửa/Xem/Cập nhật/Xóa). Nút \"Tải lên tệp\" mở modal kéo thả hoặc chọn tệp, upload ngay kèm progress bar (`onUploadProgress` của axios), nhận PDF/DOCX/TXT/MD tối đa 10 MB.

Không còn nút \"Thêm thủ công\", nút Embed riêng hay khối lịch sử hội thoại. Đã bỏ endpoint `/api/admin/chatbot/history`.

Cập nhật tài liệu (`ingest.ts`):

- Upload, parse, chunk không gọi AI, luôn chạy.
- Embed chunk chỉ khi `isConfigured()` = true.
- Nút \"Cập nhật\" chia lại chunk rồi embed lại.
- `GET /api/admin/chatbot/documents/stats` trả `totalDocuments`, `totalChunks`, `embeddedChunks`, `ready`, `failed`.

`ai_setting` chỉ lưu `max_suggestions` và `extra_rules` (`server/src/user/chatbot/service.ts:31-39`); model/embedding đọc từ biến môi trường.

## Thống kê và seed

Seed bị bỏ qua nếu DB đã có user. Đổi dữ liệu mẫu thì database cũ vẫn giữ giá trị cũ; reset bằng `docker compose --profile prod down -v` rồi `up` lại.

Tiếp theo: [API](API) hoặc [Kiểm thử](Kiem-thu).
