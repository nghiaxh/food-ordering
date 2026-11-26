# Luồng khách hàng

Trang này đi theo trải nghiệm của khách: từ trang chủ tới chi tiết món, giỏ hàng và thông báo. Trang [Đặt món và thanh toán](Luong-dat-mon) xử lý phần đặt đơn.

## Trải nghiệm trên màn hình

- Trang chủ `/` là thực đơn. Header sticky, chip danh mục, bộ lọc giá, khẩu phần, chế độ ăn, sắp xếp, phân trang 12 món/trang.
- Bấm vào ảnh hoặc tên món đi tới `/foods/:id`, trang chi tiết trong `DefaultLayout`.
- Bấm dấu cộng trên thẻ món: nếu chưa đăng nhập thì chuyển sang `/login`, nếu đã đăng nhập thì thêm vào giỏ và mở drawer giỏ.
- Nút giỏ trên header mở drawer toàn cục; chuông mở drawer thông báo.

## Trang chủ và lọc món

`client/src/user/menu/pages/FoodsPage.vue` đọc filter từ URL query (`category`, `keyword`, `min`, `max`, `people`, `sort`, `diet`, `spicy`, `available`, `deal`, `page`) bằng `useRoute().query`. Mỗi thay đổi filter gọi lại API.

Hai nơi lọc:

1. Server trả danh sách theo danh mục, giá, khẩu phần, từ khoá, còn bán (`server/src/user/menu/service.ts:9-33`).
2. Client lọc thêm theo chế độ ăn, độ cay, khuyến mãi đang có (`FoodsPage.vue:129-140`), vì những tiêu chí này là transient do pricing engine điền thêm vào Food.

Phân trang 12 món/trang (`FoodsPage.vue:161-165`).

## Chi tiết món

`client/src/user/menu/pages/FoodDetailPage.vue` lấy món theo id, hiển thị giá gốc, giá sau khuyến mãi nếu có (`discountedPrice`, `discountAmount`, `discountPercent`, `discountLabel` từ serializer ở `server/src/lib/serializers.ts:23-33`), đánh giá và nút thêm giỏ.

`GET /api/foods/:id` không yêu cầu đăng nhập.

## Thêm vào giỏ

Luồng đầy đủ:

```mermaid
sequenceDiagram
  participant U as Khách
  participant C as FoodsPage/FoodDetail
  participant S as cartStore.add
  participant A as API
  participant D as DB
  U->>C: bấm dấu cộng
  C->>S: add(foodId, 1)
  S->>S: kiểm tra đã đăng nhập
  S->>A: POST /api/cart {foodId, quantity}
  A->>D: insert on conflict update quantity
  D-->>A: CartItem
  A-->>S: CartItem server
  S->>S: thay dòng tạm bằng CartItem server
```

- `client/src/user/cart/store.ts:70-110` `add` trả `Promise<boolean>`. Nếu chưa đăng nhập thì trả `false` và caller đưa khách sang `/login`.
- Store dùng `requestSeq` (`store.ts:26-29`) để áp response đúng thứ tự, tránh race khi thêm nhanh nhiều món.
- `withServerItem` (`store.ts:13-24`) thay dòng optimistic bằng `CartItem` server trả về, để món thêm từ chatbot có đủ field và giá đúng.
- Server `addToCart` (`server/src/user/cart/service.ts:28-52`) dùng `insert ... onConflictDoUpdate` cộng dồn `quantity`, nhờ unique index `(user_id, food_id)` ở `server/src/db/schema.ts:105-107`.
- Món ngừng phục vụ bị chặn ở server (`server/src/user/cart/service.ts:34-46`).

## Giỏ hàng

Drawer giỏ mở bằng `uiStore` (`client/src/shared/stores/uiStore.ts`), không phải state cục bộ. Khách chưa đăng nhập bấm giỏ thì đưa sang `/login` kèm cờ `openCart` để mở lại sau đăng nhập.

Quote (tính tiền) chạy ở `client/src/composables/useCartQuote.ts:13-50`:

- Debounce 250 ms, huỷ request cũ bằng `AbortController`.
- Gọi `POST /api/cart/quote` với đúng danh sách dòng đang hiển thị.
- Server tính bằng `priceOrder` (`server/src/user/pricing/service.ts:61-115`), không đọc lại giỏ DB.
- Client chỉ hiển thị lại `QuoteLine.lineDiscount` cho từng dòng.

Chi tiết tiền ở [Kiến trúc](Kien-truc).

## Thông báo

`user/notification/store.ts` là nguồn chung cho header (số chưa đọc) và drawer (danh sách). `load()` lỗi mạng thì **giữ nguyên** danh sách cũ, không xoá sạch (`store.ts:20-29`).

Thông báo được tạo ở server khi:

- Tạo đơn (`server/src/user/order/service.ts:128-132`).
- Khách hủy đơn (`server/src/user/order/service.ts:172`).
- Thanh toán (`server/src/user/order/service.ts:208-214`).
- Admin đổi trạng thái hoặc sửa đơn (`server/src/admin/order/service.ts`).
- Job hết hạn đơn QR (`server/src/user/order/expiryJob.ts`).

Drawer thông báo cố tình bỏ `#header` và `closable`, nên không có thanh tiêu đề hay nút X; đóng bằng mask hoặc Esc.

## Đánh giá món

- Khách đã mua món mới được viết đánh giá (`server/src/user/review/service.ts`).
- Mỗi người một đánh giá cho mỗi món, chặn bằng code vì không có unique index (`server/src/user/review/service.ts:71-80`).
- `mine` trong DTO chỉ là gợi ý hiển thị nút Sửa/Xoá; quyền thật kiểm ở server.

## Hồ sơ

`GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/password`. Đổi mật khẩu yêu cầu mật khẩu cũ. Xem `server/src/user/profile/routes.ts`.

Tiếp theo: [Đặt món và thanh toán](Luong-dat-mon) để theo dõi đơn sau khi đặt.
