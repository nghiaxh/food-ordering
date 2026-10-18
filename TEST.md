# Hướng dẫn kiểm tra và test

Tài liệu này ghi rõ các kiểm tra đang có của FoodOrdering và lộ trình bổ sung test cho
client, server và end-to-end.

> **Trạng thái hiện tại:** dự án chưa có test tự động. `client/package.json` chưa có script
> `npm test`, `server/src/test/` chưa tồn tại và thư mục `e2e/` chưa được tạo. `mvn test`
> hiện build thành công nhưng báo không có test source.
>
> **Đã kiểm chứng thủ công (không tự động hoá):** các ràng buộc ở bảng "Ràng buộc nghiệp vụ đã
> kiểm chứng" bên dưới đã chạy thật trên stack `prod` bằng HTTP và trên trình duyệt. Khi sửa
> code liên quan tới những ràng buộc này, chạy lại các bước tương ứng vì chưa có test tự động
> bảo vệ chúng.

## Tổng quan

| Hạng mục | Trạng thái | Cần Docker | Lệnh |
|----------|------------|:----------:|------|
| Client typecheck | Có | Không | `cd client && npm run typecheck` |
| Client build | Có | Không | `cd client && npm run build` |
| Server compile/test | Có, hiện có 0 test | Không | `cd server && mvn test` |
| Client unit test | Chưa cài đặt | Không | Dự kiến: Vitest + Testing Library |
| Server unit/integration | Chưa cài đặt | Có khi dùng Testcontainers | Dự kiến: JUnit 5 + Testcontainers |
| E2E | Chưa cài đặt | Cần stack chạy | Dự kiến: Playwright trong `e2e/` |

## Kiểm tra hiện có

Chạy từ thư mục tương ứng:

```bash
# Client: kiểm tra TypeScript và build Vite
cd client
npm run typecheck
npm run build

# Server: compile, chạy test hiện có và đóng gói
cd ../server
mvn test
mvn package
```

Hiện tại không có linter, Vitest, test source hoặc test E2E. Không chạy `npm test` ở client
vì script này chưa được khai báo.

## 1. Client tests (kế hoạch)

Khi bổ sung Vitest và `@testing-library/react`, có thể dùng cấu hình `vitest.config.ts`
với `jsdom` hoặc `happy-dom`. Các test nên tập trung vào logic dễ lỗi:

| Khu vực | Nội dung dự kiến |
|---------|------------------|
| `store/cartStore` | Thêm/sửa/xóa/clear giỏ, hợp nhất giỏ khách và rollback khi API lỗi |
| `store/authStore` | Lưu/khôi phục/đăng xuất phiên JWT |
| `api/http` | Gắn `Authorization: Bearer` và xử lý 401 |
| `hooks/useAsyncData` | Hủy request cũ, retry lỗi mạng và chống response stale |
| `hooks/useAsyncAction` | Khóa submit kép và trạng thái pending |
| `components/ChatbotWidget` | Gửi tin, retry, render thẻ món và lỗi request |

## 2. Server tests (kế hoạch)

Khi bổ sung JUnit 5 và Testcontainers, chạy từ `server/`:

```bash
mvn test
```

Docker chỉ bắt buộc khi các integration test thực sự dùng Testcontainers để khởi động
PostgreSQL. `mvn test` ở trạng thái hiện tại không cần Docker.

Các test dự kiến:

| Service | Nội dung |
|---------|----------|
| `AuthService` | Đăng ký trùng email, login sai mật khẩu, tài khoản bị khóa |
| `FoodService` | Tìm kiếm/lọc theo từ khóa, danh mục, khoảng giá và available |
| `OrderService` | Tạo đơn, giá lấy từ DB, từ chối món ngừng phục vụ, ghi chú quá 255 ký tự bị chặn |
| `ChatbotService` | Trích xuất tiêu chí, lọc món và fallback khi JSON/AI lỗi |
| `AiClient` | Ánh xạ response Gemini thành text bằng HTTP mock |
| `KnowledgeService` | Tách đoạn 500 ký tự và chấm điểm theo từ khóa |

## 3. E2E tests (kế hoạch)

Khi tạo thư mục `e2e/` và thêm Playwright, chạy stack dev trước:

```bash
docker compose --profile dev up --build   # từ repo root
cd e2e
npm install
npm test
```

Kịch bản ưu tiên:

- Luồng đặt món: đăng nhập → chọn món → giỏ hàng → đặt → theo dõi đơn.
- Luồng chatbot: hỏi "món Việt, không cay, 100k" → nhận câu trả lời và thẻ món thật.
- Ghi chú đơn: nhập "Lưu ý cho quán" ở `/cart` → đặt món → modal thành công đếm ngược rồi về
  `/foods`; mở `/orders` thấy dòng ghi chú trên đúng thẻ đơn đó; admin mở drawer chi tiết
  đơn thấy khối "Lưu ý cho quán". Gửi ghi chú dài hơn 255 ký tự phải bị chặn.
- Chuyển đổi hiển thị ở `/foods`: nút list/grid đổi giữa hàng dọc và lưới card, danh sách vẫn
  chia section theo danh mục; tải lại trang thì về lại mặc định theo cỡ màn hình.

## Ràng buộc nghiệp vụ đã kiểm chứng

Các mục dưới đây đã được gọi thật trên stack `prod` và quan sát mã trả về. Chúng là hợp đồng
với tài liệu đặc tả, không phải chi tiết cài đặt tự nhiên. Sửa code làm mất một trong các
mục này là hồi quy.

| Ràng buộc | Cách kiểm |
|-----------|-----------|
| Mật khẩu ≥ 8 ký tự | `POST /api/auth/register` với mật khẩu 7 ký tự trả 400 |
| Số điện thoại đúng 10 chữ số | `POST /api/auth/register` với `phone: "123"` trả 400 |
| `/api/auth/me` và `/api/auth/password` yêu cầu đăng nhập | gọi không header trả 401 |
| Lỗi validation trả đúng mã 400 | bất kỳ request sai dữ liệu nào, xem mục `/error` trong `ARCHITECTURE.md` |
| Món ngừng phục vụ không thêm được vào giỏ | `POST /api/cart/items` trả 400 |
| Món đã có trong đơn không xoá được | `DELETE /api/admin/foods/{id}` trả 409 kèm gợi ý ngừng phục vụ |
| Không khoá/xoá được tài khoản quản trị | `PATCH /api/admin/users/{id}/active` trả 400 |
| Trạng thái đơn đi đúng một chiều | `PATCH /api/admin/orders/{id}/status` nhảy cóc trả 400 |
| Khách chỉ hủy được đơn của mình còn chờ xác nhận | `PATCH /api/orders/{id}/cancel`, hủy lần hai trả 400 |
| Khách không thao tác được đơn người khác | dùng token khách gọi `/api/admin/orders/**` trả 403 |
| Chỉ khách đã đăng nhập mới lưu lịch sử chat | `GET /api/admin/chatbot/history` không có tin nhắn `user = null` |
| Tài liệu rỗng hoặc PDF scan bị từ chối | `POST /api/admin/chatbot/documents` trả 400 |
| Ảnh sai định dạng bị từ chối dù khai Content-Type hợp lệ | `POST /api/admin/uploads/image` trả 400 |
| Sửa/xoá đánh giá chỉ của chính mình | `PUT`/`DELETE /api/reviews/{id}` trả 403 với đánh giá người khác |

Kiểm tra giao diện đã chạy trên trình duyệt: bảng món là trang chủ `/` với rail danh mục,
dải khoảng giá, lưới thẻ món và thanh giỏ ghim đáy; chi tiết món mở thành panel phủ và nút quay
lại của trình duyệt đóng được panel; ô tìm kiếm trên thanh điều hướng lọc được và ghi vào URL;
đặt món xong chuyển thẳng sang trang đơn hàng; nút mở chatbot tự nhường thanh giỏ; trang quản
trị không còn hàng thẻ số liệu; `/profile` có 3 ô mật khẩu; sửa và xoá đánh giá của chính mình
hoạt động từ trang chi tiết món.

Đo lại sau khi nén giao diện ở cửa sổ 848×670: header 65px → 57px, chiều cao thẻ món 444px →
285px, ảnh thẻ 292px → 161px, số cột 2 → 3, vùng lưới 546px → 614px. Nút mở chatbot đo ra
64×64px đúng như khai báo. Khung chat mở lên không tràn vào thanh điều hướng (đỉnh khung nằm
ngay dưới header) và không bị thanh giỏ che (còn 24px).

**Chưa kiểm được:** bộ công cụ trình duyệt không đổi được kích thước cửa sổ nên chưa xác minh
trực quan được ở 390px như iPhone. Các thay đổi dùng breakpoint sẵn có của Tailwind nên rủi ro
thấp, nhưng nên mở bằng thiết bị thật một lượt trước khi nộp.

### Chatbot

Đã chạy thật: hỏi "Gợi ý món chay không cay" và "Món nào không chứa hải sản?" đều trả về câu
báo lỗi ngắn và **0 thẻ món**; trước khi sửa hai câu này trả về 5 món rẻ nhất không liên quan
(cà phê sữa đá, nước cam ép...). Trên giao diện: câu chào không còn nhắc tên thương hiệu, 3 ô
gợi ý nằm ngay dưới câu chào và biến mất sau tin đầu tiên, tin bot không có bong bóng, nút gửi
nằm trong ô nhập, nút "Xem thực đơn" hiện đúng một lần ở tin bot gần nhất và trỏ tới `/`.

Bố cục danh sách món trong khung chat (một khung, các dòng ngăn đường kẻ, ảnh 40px, tên và
giá cùng hàng) đã soi bằng cách bật tạo thẻ món trên server rồi hoàn tác, vì khoá API hiện
không hợp lệ nên API không bao giờ trả thẻ món.

**Chưa kiểm được:** luồng thành công (AI thật trả lời kèm danh sách món khớp câu hỏi) vì
`AI_API_KEY` trong `.env` không hợp lệ. Sau khi thay khoá thật thì chạy lại: hỏi "món chay
dưới 100k" phải ra đúng các món chay dưới 100k, và hỏi "món nào chứa đậu nành" phải lọc đúng.

### Cập nhật tài liệu tri thức đã seed

`DataSeeder` bị bỏ qua khi DB đã có user, nên sửa nội dung tài liệu mẫu phải cập nhật thẳng
DB đang chạy:

```sql
UPDATE knowledge_document SET content = '...' WHERE title = 'quy-dinh-phuc-vu.txt';
```

Câu "Phí giao hàng 15.000 đồng" đã bị bỏ vì `OrderService.create` chỉ cộng tiền món, không
cộng phí giao hàng; chatbot sẽ nói sai số tiền khách phải trả.

### Xoá tài khoản khách hàng

Đã chạy thật qua API với tài khoản quản trị:

| Trường hợp | Kết quả |
|---|---|
| Khách đã có đơn hàng | `409`, thông báo "Không xoá được: khách đã có 1 đơn hàng. Hãy khoá tài khoản để giữ lịch sử." |
| Khách chưa có dữ liệu phụ thuộc | `200`, xoá thành công |

Trước khi sửa, trường hợp đầu trả `500` kèm nguyên văn lỗi SQL (`violates foreign key...`),
vừa hỏng chức năng vừa lộ tên bảng và tên ràng buộc CSDL cho client. Nay `AuthService.adminDelete`
đếm đơn và đánh giá trước khi xoá, còn `config/ApiExceptionHandler` chặn
`DataIntegrityViolationException` còn sót lại thành 409 với thông báo tiếng Việt, chi tiết lỗi
chỉ ghi log server.

Lưu ý khi chạy lại: script smoke tạo tài khoản `smoke-peer@x.com` kèm một đơn hoàn thành rồi
xoá trong `finally`. Nay việc xoá đó bị từ chối có chủ đích (409), nên tài khoản sót lại và lần
sau tạo sẽ trùng email. Trước khi chạy lại, dọn bằng:

```sql
DELETE FROM review WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%');
DELETE FROM order_item WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%'));
DELETE FROM payment_transactions WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%'));
DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%');
DELETE FROM users WHERE email LIKE 'smoke-%';
```

## Lỗi đã biết

- Còn hai mục "chưa kiểm" ở trên: màn hình ở 390px, và luồng chatbot thành công khi
  `AI_API_KEY` hợp lệ.

## Ghi chú vận hành

- Dữ liệu demo được seed khi bảng `user` còn trống; xóa volume `db_data` để reset
  (`docker compose --profile prod down -v` xoá luôn volume `db_backup` và `uploads`).
- Tài khoản demo trong seed: `admin@demo.com` / `admin123`, `user@demo.com` / `user1234`
  (mật khẩu 8 ký tự theo ràng buộc). Database đã seed từ trước vẫn giữ mật khẩu cũ.
- Nếu `AI_API_KEY` sai hoặc hết hạn, chatbot trả thông báo dự phòng kèm thẻ món lọc được.
  Đây là hành vi dự kiến, không phải lỗi; luồng lọc món vẫn chạy bằng code xác định.
- Khi thêm test framework hoặc test source, cập nhật lại bảng trạng thái và lệnh tại đây.
- Không coi kết quả `mvn test` hiện tại là bằng chứng đã có kiểm thử nghiệp vụ; lệnh đang
  chủ yếu kiểm tra compile.
