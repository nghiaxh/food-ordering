# Luồng khách hàng

Trang này đi theo trải nghiệm của khách: từ trang chủ tới chi tiết món, giỏ hàng và thông báo. Trang [Đặt món và thanh toán](Luong-dat-mon) xử lý phần đặt đơn.

## Trải nghiệm trên màn hình

- Trang chủ `/` là thực đơn. Header sticky, chip danh mục, bộ lọc giá, khẩu phần, chế độ ăn, sắp xếp, phân trang 12 món/trang.
- Bấm vào ảnh hoặc tên món đi tới `/foods/:id`, trang chi tiết trong `DefaultLayout`.
- Bấm dấu cộng trên thẻ món: nếu chưa đăng nhập thì chuyển sang `/login`, nếu đã đăng nhập thì thêm vào giỏ và mở drawer giỏ.
- Nút giỏ trên header mở drawer toàn cục; chuông mở drawer thông báo.

## Sơ đồ tuần tự: thêm món vào giỏ

```mermaid
sequenceDiagram
  autonumber
  participant U as Khách
  participant C as FoodsPage / FoodDetail
  participant S as cartStore.add
  participant A as API
  participant D as PostgreSQL
  U->>C: bấm dấu cộng
  C->>S: add(food, 1)
  S->>S: kiểm tra đã đăng nhập (auth.user)
  alt chưa đăng nhập
    S-->>C: false
    C->>U: chuyển sang /login
  else đã đăng nhập
    S->>A: POST /api/cart/items {foodId, quantity}
    A->>D: insert on conflict do update quantity
    D-->>A: CartItem
    A-->>S: CartItem server
    S->>S: thay dòng tạm bằng CartItem server (withServerItem)
    S-->>C: true
    C->>U: mở drawer giỏ
  end
```

## Trang chủ và lọc món

`client/src/user/menu/pages/FoodsPage.vue` đọc filter từ URL query (`category`, `keyword`, `min`, `max`, `people`, `sort`, `diet`, `spicy`, `available`, `deal`, `page`) bằng `useRoute().query`. Mỗi thay đổi filter gọi lại API.

Hai nơi lọc:

1. Server trả danh sách theo danh mục, giá, khẩu phần, từ khóa, còn bán (`server/src/user/menu/service.ts:9-33`).
2. Client lọc thêm theo chế độ ăn, độ cay, khuyến mãi đang có (`FoodsPage.vue:129-140`), vì những tiêu chí này là transient do pricing engine điền thêm vào Food.

Phân trang 12 món/trang (`FoodsPage.vue:161-165`).

### Code: lọc client theo chế độ ăn và độ cay

Tọa độ: `client/src/user/menu/pages/FoodsPage.vue:129-140` và `:161-165`.

Vào: danh sách món server trả về. Ra: danh sách đã lọc + số trang.

```ts
// Loc them o client: che do an, do cay, con ban, khuyen mai.
const filtered = computed(() => {
  let list = foods.value ?? []
  if (diet.value) list = list.filter((f) => hasDietTag(f, diet.value!))
  if (noSpicy.value) list = list.filter((f) => f.spicyLevel === 0)
  if (onlyAvailable.value) list = list.filter((f) => f.available)
  if (onlyDeals.value) list = list.filter((f) => (f.discountPercent ?? 0) > 0)

  const sorted = [...list]
  if (sort.value === 'price-asc') sorted.sort((a, b) => priceOf(a) - priceOf(b))
  else if (sort.value === 'price-desc') sorted.sort((a, b) => priceOf(b) - priceOf(a))
  else if (sort.value === 'discount') sorted.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
  return sorted
});

// Phan trang 12 mon/trang.
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const visible = computed(() =>
  filtered.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE),
);
```

Từng bước:
- `FoodsPage.vue:129-140`: lọc thêm các tiêu chí transient (chế độ ăn, độ cay, còn bán, có khuyến mãi).
- `FoodsPage.vue:161-165`: tính số trang và cắt danh sách theo trang.

Vì sao: các tiêu chí này không có trong query server vì là dữ liệu tính thêm bởi pricing engine; lọc ở client tránh gọi API lại.

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
  S->>S: thay dòng optimistic bằng CartItem server
```

- `client/src/user/cart/store.ts:70-110` `add` trả `Promise<boolean>`. Nếu chưa đăng nhập thì trả `false` và caller đưa khách sang `/login`.
- Store dùng `requestSeq` (`store.ts:26-29`) để áp response đúng thứ tự, tránh race khi thêm nhanh nhiều món.
- `withServerItem` (`store.ts:13-24`) thay dòng optimistic bằng `CartItem` server trả về, để món thêm từ chatbot có đủ field và giá đúng.
- Server `addToCart` (`server/src/user/cart/service.ts:28-52`) dùng `insert ... onConflictDoUpdate` cộng dồn `quantity`, nhờ unique index `(user_id, food_id)` ở `server/src/db/schema.ts:105-107`.
- Món ngừng phục vụ bị chặn ở server (`server/src/user/cart/service.ts:34-46`).

### Code: store thêm món và áp response đúng thứ tự

Tọa độ: `client/src/user/cart/store.ts:13-24` và `:26-39` và `:70-89`.

Vào: `Food` và `quantity`. Ra: `Promise<boolean>` (true nếu thành công).

```ts
// Thay dong optimistic bang CartItem server tra ve.
const withServerItem = (items: CartItem[], item: CartItem): CartItem[] => {
  const id = item.food?.id
  if (id == null) return items
  return items.some((i) => i.food?.id === id)
    ? items.map((i) => (i.food?.id === id ? item : i))
    : [...items, item]
}

// So thu tu request theo tung mon: chi response cua request moi nhat duoc ghi vao gio.
const requestSeq = new Map<number, number>()
const beginRequest = (foodId: number) => {
  const seq = (requestSeq.get(foodId) ?? 0) + 1
  requestSeq.set(foodId, seq)
  return { seq, generation: cartGeneration }
}
const canApply = (foodId: number, token) =>
  token.generation === cartGeneration && requestSeq.get(foodId) === token.seq

async add(food: Food, quantity = 1): Promise<boolean> {
  if (!loggedIn()) return false // chua dang nhap -> caller dua sang /login
  const token = beginRequest(food.id)
  const before = this.items
  const existing = before.find((i) => i.food?.id === food.id)
  this.items = existing
    ? before.map((i) => (i.food?.id === food.id ? { ...i, quantity: i.quantity + quantity } : i))
    : [...before, { food, quantity }]
  try {
    const saved = await addCartItem(food.id, quantity)
    if (canApply(food.id, token)) this.items = withServerItem(this.items, saved)
    return true
  } catch {
    if (canApply(food.id, token)) this.items = before
    return false
  }
}
```

Từng bước:
- `store.ts:13-24`: thay dòng tạm bằng CartItem server để đủ field và giá đúng.
- `store.ts:26-39`: đánh số thứ tự request theo từng món.
- `store.ts:70-89`: thêm optimistic, gọi API, chỉ áp response nếu là request mới nhất.

Vì sao: khi thêm nhanh nhiều món, response cũ có thể ghi đè response mới; `beginRequest`/`canApply` chặn điều đó.

### Code: server cộng dồn số lượng

Tọa độ: `server/src/user/cart/service.ts:28-52`.

Vào: `email`, `foodId`, `quantity`. Ra: `CartItem` đã cộng dồn.

```ts
// Them mon vao gio, cong don so luong nho unique index (user_id, food_id).
export async function addToCart(email: string, foodId: number, quantity: number) {
  const user = await getUserOrThrow(email);
  const food = await db.query.foods.findFirst({ where: eq(foods.id, foodId) });
  if (!food) throw badRequest("Mon khong ton tai");
  if (!food.available) throw badRequest(`Mon "${food.name}" hien khong phuc vu`);

  const [item] = await db
    .insert(cartItems)
    .values({ userId: user.id, foodId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.foodId],
      set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
    })
    .returning();

  const saved = await db.query.cartItems.findFirst({
    where: eq(cartItems.id, item!.id),
    with: { food: { with: { category: true } } },
  });
  return toCartItemJson(saved!);
}
```

Từng bước:
- `service.ts:30-34`: kiểm món tồn tại và còn bán.
- `service.ts:36-44`: insert, nếu trùng (user, food) thì cộng dồn quantity.

Vì sao: unique index `(user_id, food_id)` (`server/src/db/schema.ts:105-107`) là điều kiện cho `onConflictDoUpdate`; tránh read-then-write.

## Giỏ hàng

Drawer giỏ mở bằng `uiStore` (`client/src/shared/stores/uiStore.ts`), không phải state cục bộ. Khách chưa đăng nhập bấm giỏ thì đưa sang `/login` kèm cờ `openCart` để mở lại sau đăng nhập.

Quote (tính tiền) chạy ở `client/src/composables/useCartQuote.ts:13-50`:

- Debounce 250 ms, hủy request cũ bằng `AbortController`.
- Gọi `POST /api/cart/quote` với đúng danh sách dòng đang hiển thị.
- Server tính bằng `priceOrder` (`server/src/user/pricing/service.ts:61-115`), không đọc lại giỏ DB.
- Client chỉ hiển thị lại `QuoteLine.lineDiscount` cho từng dòng.

### Code: quote với debounce và hủy request cũ

Tọa độ: `client/src/composables/useCartQuote.ts:13-50`.

Vào: danh sách `CartItem[]`. Ra: `CartQuote | null`.

```ts
watch(
  [items, attempt],
  (_value, _oldValue, onCleanup) => {
    const current = items()
    if (current.length === 0) {
      quote.value = null
      quoteLoading.value = false
      quoteError.value = false
      return
    }
    quoteLoading.value = true
    quoteError.value = false
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      quoteCart(
        current
          .filter((i) => i.food)
          .map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
        ctrl.signal,
      )
        .then((next) => {
          quote.value = next
          quoteLoading.value = false
        })
        .catch((error: unknown) => {
          if ((error as { code?: string })?.code === 'ERR_CANCELED') return
          quote.value = null
          quoteLoading.value = false
          quoteError.value = true
        })
    }, QUOTE_DEBOUNCE_MS)
    onCleanup(() => {
      window.clearTimeout(timer)
      ctrl.abort()
    })
  },
  { deep: true, immediate: true },
);
```

Vì sao: debounce 250ms tránh spam API khi sửa số lượng; `AbortController` tránh response cũ ghi đè response mới.

## Thông báo

`user/notification/store.ts` là nguồn chung cho header (số chưa đọc) và drawer (danh sách). `load()` lỗi mạng thì **giữ nguyên** danh sách cũ, không xóa sạch (`store.ts:20-29`).

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
- `mine` trong DTO chỉ là gợi ý hiển thị nút Sửa/Xóa; quyền thật kiểm ở server.

## Hồ sơ

`GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/password`. Đổi mật khẩu yêu cầu mật khẩu cũ. Xem `server/src/user/profile/routes.ts`.

Tiếp theo: [Đặt món và thanh toán](Luong-dat-mon) để theo dõi đơn sau khi đặt.
