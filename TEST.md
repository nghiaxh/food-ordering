# Hướng dẫn kiểm tra và test

Tài liệu này ghi rõ các kiểm tra đang có của FoodOrdering và lộ trình bổ sung test cho
client, server và end-to-end.

> **Trạng thái hiện tại:** server đã có test tự động đầu tiên (`server/src/test/java/com/
> foodordering/service/ChatbotServiceTest.java`, 5 test) chạy bằng JUnit 5 + Mockito, không
> cần Docker. `client/package.json` chưa có script `npm test` và thư mục `e2e/` chưa được
> tạo, nên phía client vẫn mới chỉ có typecheck và build.
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
| Server compile/test | Có, hiện có 5 test | Không | `cd server && mvn test` |
| Client unit test | Chưa cài đặt | Không | Dự kiến: Vitest + Testing Library |
| Server unit/integration | Có test unit, chưa có test tích hợp | Có khi dùng Testcontainers | Dự kiến: Testcontainers |
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

Chưa có linter, Vitest, test E2E. Không chạy `npm test` ở client vì script này chưa được
khai báo.

## 0. Server unit test đã có

`server/src/test/java/com/foodordering/service/ChatbotServiceTest.java` — 5 test, chạy ở mức
service với repository và `AiClient` giả lập, nên không cần database hay Docker. Test bọc
`AiClient.generate` để trả về JSON tiêu chí đã định sẵn, rồi kiểm tra danh sách món server
lọc ra:

| Test | Kiểm chứng |
|------|------------|
| `tuVanTheoSoNguoi` | Số phần tính theo khẩu phần (Phở bò khẩu phần 1 người, 2 người ăn → 2 phần = 130.000đ) và mọi món đều vừa tổng ngân sách |
| `tuVanKetHopMon` | Câu hỏi "1 món chính + 1 món uống" trả về đúng 2 món, đúng danh mục, tổng tiền không vượt ngân sách |
| `tuVanTheoKhauVi` | Món gợi ý đều không cay và không chứa thành phần khách loại trừ |
| `aiLoiKhongGoiYMon` | AI lỗi thì không gợi ý món nào, không bịa món |
| `aiTraThemTruongLa` | AI trả JSON có thêm trường lạ thì tiêu chí vẫn được dùng |

Lệnh chạy riêng: `cd server && mvn test -Dtest=ChatbotServiceTest`

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

## Ghi chú vận hành

- Dữ liệu demo được seed khi bảng `user` còn trống; xóa volume `db_data` để reset.
- Khi thêm test framework hoặc test source, cập nhật lại bảng trạng thái và lệnh tại đây.
- Không coi kết quả `mvn test` hiện tại là bằng chứng đã có kiểm thử nghiệp vụ; lệnh đang
  chủ yếu kiểm tra compile.
