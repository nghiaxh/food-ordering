# Kiß║┐n tr├║c FoodOrdering

M├┤ tß║ú ngß║»n gß╗ìn c├ích FoodOrdering vß║¡n h├ánh v├á c├íc quy ╞░ß╗¢c quan trß╗ìng. Chi tiß║┐t ca kiß╗âm thß╗¡ xem [TEST.md](TEST.md).

## Tß╗òng quan

ß╗¿ng dß╗Ñng **─æß║╖t m├│n trß╗▒c tuyß║┐n** theo m├┤ h├¼nh monorepo clientΓÇôserver. ─Éiß╗âm kh├íc biß╗çt: trß╗ú l├╜ AI
t╞░ vß║Ñn m├│n theo ng├┤n ngß╗» tß╗▒ nhi├¬n, gß╗úi ├╜ lu├┤n nß║▒m trong thß╗▒c ─æ╞ín thß║¡t v├á ─æß║╖t ─æ╞░ß╗úc ngay.

```
ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ     VITE_API_URL (Bearer JWT)      ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
Γöé  Client SPA      Γöé ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓû╢ Γöé  Express server       Γöé
Γöé  (Vite)          Γöé ΓùÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ Γöé  Node 26 + Drizzle    Γöé
ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ                                    ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓö¼ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ
                                                              PostgreSQL 18
```

> **Trß║íng th├íi chuyß╗ân ─æß╗òi**: server ─æ├ú chuyß╗ân sang Express 5 + Drizzle ORM (Node 26) + PostgreSQL 18; client ─æ├ú chuyß╗ân sang Vue 3 + Naive UI. H├ánh vi nghiß╗çp vß╗Ñ kh├┤ng ─æß╗òi.

- **client/**: Vue 3 + TypeScript 5.9 + Vite 8 + Naive UI + Pinia + Axios + Vue Router. SPA thuß║ºn, kh├┤ng SSR. UI tiß║┐ng Viß╗çt. API client d├╣ng `VITE_API_URL` l├ám `baseURL` (mß║╖c ─æß╗ïnh `http://localhost:8080/api`). Nginx ß╗ƒ prod chß╗ë phß╗Ñc vß╗Ñ static SPA v├á fallback route.
- **server/**: Express 5 + TypeScript 7 + Drizzle ORM (Node 26). JWT bß║▒ng `jsonwebtoken` (HS256) v├á mß║¡t khß║⌐u bß║▒ng `bcrypt`; quyß╗ün kiß╗âm tra ß╗ƒ server bß║▒ng middleware. Schema CSDL ─æß╗ïnh ngh─⌐a bß║▒ng TypeScript (`src/db/schema.ts`), quß║ún l├╜ migration bß║▒ng `drizzle-kit`.
- **PostgreSQL 18**: cß║Ñu h├¼nh tß╗½ `DATABASE_URL` (compose tß╗▒ dß╗▒ng tß╗½ `DB_NAME`/`DB_USER`/`DB_PASSWORD`).

## Luß╗ông dß╗» liß╗çu ch├¡nh

### 1. X├íc thß╗▒c (JWT access token)

1. Client gß╗ìi `POST /api/auth/login` hoß║╖c `POST /api/auth/register` vß╗¢i email v├á mß║¡t khß║⌐u.
2. Server trß║ú vß╗ü access token JWT k├¿m th├┤ng tin user v├á role (ADMIN / CUSTOMER).
3. `authStore` l╞░u phi├¬n theo lß╗▒a chß╗ìn remember: `localStorage` hoß║╖c `sessionStorage`.
4. `api/http` ─æß╗ìc token tß╗½ `localStorage`, ch╞░a c├│ th├¼ lß║Ñy tß╗½ `sessionStorage`, rß╗ôi gß║»n
   `Authorization: Bearer <token>` cho request. Khi gß║╖p 401 sß║╜ xo├í token ß╗ƒ cß║ú hai kho v├á ─æ╞░a
   ng╞░ß╗¥i d├╣ng vß╗ü trang ─æ─âng nhß║¡p.
5. `requireAuth`/`optionalAuth` middleware (`server/src/middleware/auth.ts`) tr├¬n server ─æß╗ìc v├á verify
   token (`jsonwebtoken`), **tra CSDL mß╗ùi request** kiß╗âm tra t├ái khoß║ún c├▓n `active` rß╗ôi mß╗¢i dß╗▒ng
   `id/email/role` v├áo `req.user`. Token kh├┤ng hß╗úp lß╗ç hoß║╖c t├ái khoß║ún ─æ├ú bß╗ï kho├í ─æ╞░ß╗úc coi nh╞░ ch╞░a
   ─æ─âng nhß║¡p. Cß║ºn tra CSDL mß╗ùi request v├¼ token vß║½n c├▓n hß║ín sau khi admin kho├í t├ái khoß║ún.
6. Ph├ón quyß╗ün ß╗ƒ `middleware/auth.ts`: stateless, kh├┤ng session. Ma trß║¡n quyß╗ün: `/api/auth/register`,
   `/api/auth/login` kh├┤ng cß║ºn token; `GET /api/foods/**`, `/api/categories/**`, `/api/reviews/**`,
   `/api/uploads/**` v├á `/api/chatbot/**` c├┤ng khai; `/api/cart/**`, `/api/orders`, `/api/orders/**`
   y├¬u cß║ºu role `CUSTOMER`; `/api/admin/**` y├¬u cß║ºu role `ADMIN`; phß║ºn c├▓n lß║íi cß║ºn ─æ─âng nhß║¡p.

Endpoint v├á ch├¡nh s├ích public hiß╗çn tß║íi:

- `POST /api/auth/register` v├á `POST /api/auth/login` kh├┤ng cß║ºn token.
  `/api/auth/me` v├á `/api/auth/password` y├¬u cß║ºu ─æ─âng nhß║¡p, gß╗ìi v├┤ danh sß║╜ nhß║¡n 401.
- `GET /api/foods/**`, `/api/categories/**`, `GET /api/reviews/**`, `GET /api/uploads/**`
  (ß║únh admin tß║úi l├¬n ─æ╞░ß╗úc phß╗Ñc vß╗Ñ c├┤ng khai v├¼ mß╗ìi kh├ích ─æß╗üu cß║ºn xem thß╗▒c ─æ╞ín).
- `POST /api/chatbot/chat`: t╞░ vß║Ñn m├│n, kh├ích v├úng lai vß║½n d├╣ng ─æ╞░ß╗úc.
- Mß╗ìi lß╗ùi tß╗½ handler (validation, nghiß╗çp vß╗Ñ, kh├┤ng t├¼m thß║Ñy) ─æi qua `middleware/error.ts` v├á trß║ú
  vß╗ü ─æ├║ng m├ú 4xx k├¿m `{ message }` tiß║┐ng Viß╗çt; validation sai JSON trß║ú 400 chß╗⌐ kh├┤ng phß║úi 500.
- `POST /api/reviews` y├¬u cß║ºu ─æ─âng nhß║¡p v├¼ chß╗ë c├│ route GET ─æ╞░ß╗úc public.

Bß║úo vß╗ç route tr├¬n client chß╗ë l├á UX - **quyß╗ün ADMIN ─æ╞░ß╗úc kiß╗âm so├ít ß╗ƒ server**.

### 2. Duyß╗çt v├á t├¼m m├│n

- Trang danh mß╗Ñc gß╗ìi `GET /api/foods` v├á `GET /api/categories`.
- Lß╗ìc theo t├¬n, loß║íi, khoß║úng gi├í v├á trß║íng th├íi available qua query params.
- Chi tiß║┐t m├│n gß╗ôm th├ánh phß║ºn, khß║⌐u phß║ºn, ─æß╗Ö cay, nh├ún chß║┐ ─æß╗Ö ─ân, dß╗ï ß╗⌐ng, ─æ├ính gi├í.

### 3. Giß╗Å h├áng (l╞░u theo t├ái khoß║ún)

Giß╗Å h├áng **l╞░u tr├¬n server** theo t├ái khoß║ún (bß║úng `cart_items`, unique theo user + m├│n):

- Chß╗ë kh├ích ─æ├ú ─æ─âng nhß║¡p mß╗¢i c├│ giß╗Å: th├¬m/sß╗¡a/x├│a/clear m├│n qua `/api/cart/**` (y├¬u cß║ºu x├íc
  thß╗▒c), giß╗Å ─æ╞░ß╗úc l╞░u trong database v├á c├▓n nguy├¬n khi ─æ─âng nhß║¡p lß║íi tß╗½ thiß║┐t bß╗ï kh├íc.
- Kh├ích v├úng lai **kh├┤ng c├│ giß╗Å local**: n├║t "Th├¬m v├áo giß╗Å" bß╗ï kho├í, hover hoß║╖c focus hiß╗çn
  tooltip "─É─âng nhß║¡p ─æß╗â th├¬m m├│n v├áo giß╗Å". Giß╗Å mß╗ƒ th├ánh **drawer b├¬n phß║úi** tß╗½ n├║t giß╗Å tr├¬n
  header; kh├ích ch╞░a ─æ─âng nhß║¡p ─æ╞░ß╗úc ─æ╞░a sang `/login` k├¿m cß╗¥ `openCart`
  v├á quay lß║íi ─æ├║ng trang, mß╗ƒ sß║╡n drawer. `/checkout` nß║▒m trong `RequireAuth`, c├▓n `/cart` chß╗ë
  chuyß╗ân h╞░ß╗¢ng vß╗ü `/checkout`. `cartStore.add` trß║ú `false` khi ch╞░a ─æ─âng nhß║¡p nh╞░ lß╗¢p ph├▓ng thß╗º
  thß╗⌐ hai.
- ─É─âng xuß║Ñt th├¼ `CartSync` gß╗ìi `resetLocal` ─æß╗â xo├í state giß╗Å cß╗ºa t├ái khoß║ún khß╗Åi client.
- Gi├í m├│n hiß╗ân thß╗ï tß╗½ dß╗» liß╗çu trß║ú vß╗ü khi duyß╗çt m├│n.

### 4. ─Éß║╖t m├│n (gi├í lß║Ñy tß╗½ DB)

1. Client gß╗¡i `POST /api/orders` vß╗¢i danh s├ích m├│n + sß╗æ l╞░ß╗úng, th├┤ng tin ng╞░ß╗¥i nhß║¡n,
   ph╞░╞íng thß╗⌐c thanh to├ín v├á **ghi ch├║ cho qu├ín** (`note`, tß╗æi ─æa 255 k├╜ tß╗▒, tuß╗│ chß╗ìn).
2. `order` module (createOrder) set `price` = gi├í trong DB, **kh├┤ng tin gi├í tß╗½ client**; tß╗½ chß╗æi m├│n ngß╗½ng phß╗Ñc vß╗Ñ.
3. Mß╗ùi ─æ╞ín ─æ╞░ß╗úc ghi mß╗Öt giao dß╗ïch thanh to├ín (`payment_transactions`: ph╞░╞íng thß╗⌐c, sß╗æ tiß╗ün,
   trß║íng th├íi PENDING/PAID) v├á tß║ío th├┤ng b├ío x├íc nhß║¡n cho kh├ích (`notifications`).
4. Trß║íng th├íi ─æ╞ín d├╣ng c├íc gi├í trß╗ï `PENDING`, `CONFIRMED`, `PREPARING`, `COMPLETED`, `CANCELLED`
   ΓÇö `PREPARING` c├│ ngh─⌐a l├á ─æang vß║¡n chuyß╗ân, nh├ún hiß╗ân thß╗ï "─Éang vß║¡n chuyß╗ân" ß╗ƒ cß║ú client lß║½n
   th├┤ng b├ío server (m├ú trong DB kh├┤ng ─æß╗òi); trß║íng th├íi thanh to├ín d├╣ng `UNPAID` hoß║╖c `PAID`.
5. **Trß║íng th├íi ─æi ─æ├║ng mß╗Öt chiß╗üu**: `PENDING ΓåÆ CONFIRMED ΓåÆ PREPARING ΓåÆ COMPLETED`, ─æ╞░ß╗úc canh
   trong `user/order/transitions.ts` (isValidTransition). ─É╞ín ─æ├ú `COMPLETED` hoß║╖c `CANCELLED` kh├┤ng ─æß╗òi trß║íng
   th├íi ─æ╞░ß╗úc. `CANCELLED` ─æ╞░ß╗úc ph├⌐p tß╗½ mß╗ìi trß║íng th├íi ch╞░a chß╗æt. Client c┼⌐ng lß╗ìc danh s├ích trß║íng
   th├íi hß╗úp lß╗ç bß║▒ng `allowedNextStatuses`, nh╞░ng server mß╗¢i l├á n╞íi quyß║┐t ─æß╗ïnh.
6. Kh├ích tß╗▒ hß╗ºy ─æ╞░ß╗úc ─æ╞ín cß╗ºa m├¼nh qua `PATCH /api/orders/{id}/cancel`, chß╗ë khi ─æ╞ín c├▓n `PENDING`
   **v├á** ch╞░a thanh to├ín. ─É╞ín ─æ├ú `PAID` hoß║╖c ─æ├ú `CONFIRMED` th├¼ qu├ín ─æ├ú bß║»t tay l├ám, hß╗ºy l├║c ─æ├│
   l├á mß║Ñt m├│n, n├¬n server trß║ú 400 chß╗⌐ kh├┤ng chß╗ë ß║⌐n n├║t tr├¬n giao diß╗çn.
7. Thanh to├ín giß║ú lß║¡p (COD / QR) - kh├┤ng t├¡ch hß╗úp cß╗òng thanh to├ín thß║¡t.
   Kh├ích tß╗▒ x├íc nhß║¡n ─æ├ú trß║ú qua `PATCH /api/orders/{id}/pay`; admin vß║½n ghi nhß║¡n hoß║╖c ho├án t├íc
   thß╗º c├┤ng bß║▒ng `PATCH /api/admin/orders/{id}/payment?paid=...`. M├ú QR tr├¬n `/orders` do component
   QR do th╞░ viß╗çn `qrcode` render (data URL) sinh, m├ú ho├í m├ú ─æ╞ín (`FOOD-{id}-{tß╗òng tiß╗ün}`) n├¬n qu├⌐t ra chß╗ë c├│ th├┤ng tin
   nhß║¡n dß║íng ─æ╞ín, kh├┤ng phß║úi payload chuyß╗ân khoß║ún; chß╗ë hiß╗çn vß╗¢i ph╞░╞íng thß╗⌐c `QR`.
8. Admin c├│ thß╗â tß║ío, sß╗¡a v├á xo├í ─æ╞ín thay kh├ích qua `/api/admin/orders` (UC12). **Sß╗¡a m├│n chß╗ë
   khi ─æ╞ín c├▓n `PENDING` v├á ch╞░a thu tiß╗ün**; sau ─æ├│ chß╗ë c├▓n ng╞░ß╗¥i nhß║¡n, sß╗æ ─æiß╗çn thoß║íi, ─æß╗ïa chß╗ë,
   ghi ch├║ v├á trß║íng th├íi. ─É╞ín `COMPLETED` hoß║╖c `CANCELLED` bß╗ï kho├í ho├án to├án (`requireEditable`)
   ─æß╗â sß╗æ liß╗çu b├ío c├ío v├á lß╗ïch sß╗¡ cß╗ºa kh├ích kh├┤ng bß╗ï sß╗¡a ng╞░ß╗úc. Giao diß╗çn kho├í ─æ├║ng nh╞░ vß║¡y:
   n├║t Sß╗¡a bß╗ï v├┤ hiß╗çu ho├í ß╗ƒ hai trß║íng th├íi cuß╗æi, danh s├ích m├│n trong form bß╗ï disable v├á k├¿m
   d├▓ng giß║úi th├¡ch khi ─æ╞ín ─æ├ú x├íc nhß║¡n hoß║╖c ─æ├ú thu tiß╗ün.
9. Ghi ch├║ `note` chß╗ë ghi l├║c tß║ío ─æ╞ín, kh├┤ng sß╗¡a ─æ╞░ß╗úc vß╗ü sau. N╞íi ─æß╗ìc: d├▓ng "L╞░u ├╜ cho qu├ín"
   tr├¬n thß║╗ ─æ╞ín ß╗ƒ `/orders` v├á khß╗æi "L╞░u ├╜ cho qu├ín" trong drawer chi tiß║┐t ─æ╞ín cß╗ºa admin.
   N├║t "─Éß║╖t lß║íi" chß╗ë hiß╗çn ß╗ƒ ─æ╞ín `COMPLETED`, chß╗ë chuyß╗ân m├│n sang giß╗Å, kh├┤ng mang theo ghi ch├║ c┼⌐.
10. M├ú ─æ╞ín hiß╗ân thß╗ï cho kh├ích v├á quß║ún trß╗ï vi├¬n l├á `FO-xxxx` (tiß╗ün tß╗æ `FO` + id ─æß╗çm 4 chß╗» sß╗æ),
    sinh bß╗ƒi `orderCode` trong `client/src/shared/utils/orders.ts` ─æß╗â hai b├¬n kh├┤ng lß╗çch nhau. Id do
    server cß║Ñp n├¬n ─æß╗òi tiß╗ün tß╗æ kh├┤ng cß║ºn sß╗¡a dß╗» liß╗çu; m├ú QR vß║½n giß╗» `FOOD-{id}-{tß╗òng tiß╗ün}`.

### 4b. R├áng buß╗Öc dß╗» liß╗çu ß╗ƒ bi├¬n

- Mß║¡t khß║⌐u tß╗æi thiß╗âu 8 k├╜ tß╗▒, sß╗æ ─æiß╗çn thoß║íi ─æ├║ng 10 chß╗» sß╗æ bß║»t ─æß║ºu bß║▒ng 0
  (`/^0\d{9}$/` trong `auth/schema.ts` v├á `order/schema.ts`). Client v├á server c├╣ng kiß╗âm tra ─æß╗â b├ío
  lß╗ùi ngay tß║íi tr╞░ß╗¥ng nhß║¡p.
- Ph╞░╞íng thß╗⌐c thanh to├ín phß║úi thuß╗Öc danh s├ích `COD|QR` (`PAYMENT_METHOD_PATTERN` trong
  `order/schema.ts`). `COD` l├á **tiß╗ün mß║╖t khi nhß║¡n**, `QR` l├á **qu├⌐t
  m├ú QR ─æß╗â chuyß╗ân khoß║ún**; kh├┤ng c├│ ph╞░╞íng thß╗⌐c kh├íc. Nh├ún hiß╗ân thß╗ï nß║▒m ß╗ƒ
  `client/src/shared/utils/orders.ts` (`PAYMENT_METHOD_LABEL`) ─æß╗â trang kh├ích v├á trang quß║ún trß╗ï hiß╗çn
  giß╗æng nhau, kh├┤ng lß╗Ö m├ú th├┤i ra giao diß╗çn.
- Giß╗Å h├áng chß╗ë nhß║¡n m├│n ─æang phß╗Ñc vß╗Ñ (`cart` module (addToCart)); lß╗ùi hiß╗çn ß╗ƒ l├║c th├¬m chß╗⌐ kh├┤ng ─æß╗úi tß╗¢i
  l├║c ─æß║╖t.
- M├│n ─æ├ú c├│ trong ─æ╞ín kh├┤ng xo├í ─æ╞░ß╗úc (`menu` module (deleteFood) trß║ú 409 k├¿m gß╗úi ├╜ chuyß╗ân sang
  ngß╗½ng phß╗Ñc vß╗Ñ), v├¼ chi tiß║┐t ─æ╞ín vß║½n tham chiß║┐u tß╗¢i n├│.
- Admin kh├┤ng kho├í hay xo├í ─æ╞░ß╗úc t├ái khoß║ún quß║ún trß╗ï (`admin` module chß║╖n ß╗ƒ `setUserActive` v├á
  `adminDeleteUser`).

### 4c. Khuyß║┐n m├úi tß╗▒ ─æß╗Öng

Mß╗ìi con sß╗æ tiß╗ün cß╗ºa giß╗Å v├á cß╗ºa ─æ╞ín do **mß╗Öt chß╗ù duy nhß║Ñt** t├¡nh: `user/pricing`.
Client kh├┤ng tß╗▒ nh├ón phß║ºn tr─âm, kh├┤ng tß╗▒ trß╗½ voucher; n├│ gß╗¡i `POST /api/cart/quote` k├¿m
`{ items }` ─æ├║ng danh s├ích d├▓ng ─æang hiß╗ân thß╗ï v├á hiß╗çn lß║íi ─æ├║ng nhß╗»ng g├¼ server trß║ú. Quote t├¡nh
bß║▒ng `priceOrder` tr├¬n danh s├ích ─æ├│, **kh├┤ng ─æß╗ìc lß║íi giß╗Å trong DB**, n├¬n th├¬m m├│n xong kh├┤ng bß╗ï
response cß╗ºa giß╗Å c┼⌐ ghi ─æ├¿. Nhß╗¥ vß║¡y b├ío gi├í trong giß╗Å v├á tß╗òng tiß╗ün cß╗ºa ─æ╞ín ─æ├ú tß║ío kh├┤ng thß╗â
lß╗çch nhau.

- **─Éß╗ông bß╗Ö b├ío gi├í ß╗ƒ client**: `useCartQuote(items)` d├╣ng chung cho drawer giß╗Å v├á trang
  `/checkout`. Mß╗ùi lß║ºn `items` ─æß╗òi, hook abort request c┼⌐, gß╗ìi lß║íi `POST /api/cart/quote` v├á giß╗»
  sß╗æ c┼⌐ trong l├║c chß╗¥ ─æß╗â khß╗æi tß╗òng tiß╗ün kh├┤ng nh├íy. Chß╗ë khi ch╞░a c├│ quote mß╗¢i hiß╗çn "─Éang cß║¡p nhß║¡t
  gi├í..." v├á kho├í n├║t ─æß║╖t m├│n; d├▓ng m├│n tß║ím hiß╗çn gi├í gß╗æc tß╗½ cart item.
- **D├▓ng optimistic**: `cartStore.add` v├á `setQuantity` thay d├▓ng tß║ím bß║▒ng `CartItem` server trß║ú
  (food ─æß║ºy ─æß╗º field, gi├í l├á sß╗æ, `available` ─æ├║ng), n├¬n m├│n th├¬m tß╗½ chatbot kh├┤ng c├▓n d├▓ng
  "Hß║┐t m├│n" giß║ú. Mß╗ùi m├│n c├│ sß╗æ thß╗⌐ tß╗▒ request ri├¬ng; chß╗ë response cß╗ºa request mß╗¢i nhß║Ñt ─æ╞░ß╗úc ghi
  v├áo giß╗Å, n├¬n response vß╗ü muß╗Ön kh├┤ng ─æ├¿ lß║ºn bß║Ñm sau d├╣ sß╗æ l╞░ß╗úng server trß║ú kh├íc d├▓ng ─æang hiß╗ân
  thß╗ï. Xo├í sß║ích giß╗Å hoß║╖c ─æ─âng xuß║Ñt th├¼ t─âng "thß║┐ hß╗ç" giß╗Å ─æß╗â response ─æang bay kh├┤ng dß╗▒ng lß║íi d├▓ng
  vß╗½a xo├í.
- **Sß╗æ l╞░ß╗úng d├▓ng mß╗¢i**: `cart` module (addToCart) tß║ío `CartItem` vß╗¢i `quantity = 0` tr╞░ß╗¢c khi cß╗Öng,
  v├¼ cß╗Öt `quantity` mß║╖c ─æß╗ïnh 1; thiß║┐u b╞░ß╗¢c n├áy th├¼ lß║ºn th├¬m ─æß║ºu ti├¬n d╞░ 1 phß║ºn so vß╗¢i sß╗æ kh├ích chß╗ìn.

- **Mß╗Öt d├▓ng, mß╗Öt khoß║ún giß║úm.** `QuoteLine.lineDiscount` v├á `OrderItem.discountAmount` l├á sß╗æ
  tiß╗ün giß║úm cß╗ºa **cß║ú d├▓ng** (─æ├ú nh├ón sß╗æ l╞░ß╗úng), kh├┤ng phß║úi cß╗ºa mß╗Öt phß║ºn.
- **Khuyß║┐n m├úi tß╗▒ ─æß╗Öng** (ch╞░╞íng tr├¼nh kh├┤ng c├│ m├ú): mß╗ùi d├▓ng chß╗ìn **mß╗Öt** ch╞░╞íng tr├¼nh tß╗æt
  nhß║Ñt theo sß╗æ tiß╗ün giß║úm, ho├á th├¼ x├⌐t `priority`. Kh├┤ng cß╗Öng dß╗ôn hai ch╞░╞íng tr├¼nh tß╗▒ ─æß╗Öng tr├¬n
  c├╣ng mß╗Öt d├▓ng, n├¬n ho├í ─æ╞ín ─æß╗ìc mß╗Öt lß║ºn l├á hiß╗âu.
- **Phß║ím vi** `GLOBAL`, `CATEGORY`, `FOOD` quyß║┐t ─æß╗ïnh ch╞░╞íng tr├¼nh c├│ ├íp cho d├▓ng ─æ├│
  kh├┤ng (`matches`). Ch╞░╞íng tr├¼nh theo danh mß╗Ñc chß╗ë khß╗¢p m├│n.
- **Khuyß║┐n m├úi theo dß╗ïp** d├╣ng `daysOfWeek` (v├¡ dß╗Ñ `SAT,SUN`) v├á `startTime/endTime`; khung giß╗¥
  qua nß╗¡a ─æ├¬m ─æ╞░ß╗úc hiß╗âu l├á `start > end`. Ng├áy/thß╗⌐ v├á khung giß╗¥ (v├á "M├│n may mß║»n mß╗ùi ng├áy") ─æ╞░ß╗úc
  ─æ├ính gi├í theo giß╗¥ Viß╗çt Nam (`Asia/Ho_Chi_Minh`, `src/lib/businessTime.ts`), kh├┤ng theo TZ m├íy
  chß╗º; doanh thu theo ng├áy trong b├ío c├ío Excel c┼⌐ng bucket theo ng├áy lß╗ïch VN.
- **M├│n may mß║»n mß╗ùi ng├áy** (`randomCount > 0`): mß╗ùi ng├áy chß╗ìn `randomCount` m├│n bß║▒ng h├ám b─âm
  `hash(foodId, promotionId, ng├áy)` rß╗ôi sß║»p theo gi├í trß╗ï b─âm, n├¬n c├╣ng mß╗Öt ng├áy mß╗ìi ng╞░ß╗¥i thß║Ñy
  c├╣ng bß╗Ö m├│n v├á sang ng├áy mß╗¢i tß╗▒ ─æß╗òi, kh├┤ng cß║ºn scheduler.
- **Gi├í tr├¬n thß║╗ m├│n**: `GET /api/foods` v├á `GET /api/foods/{id}` ─æ╞░ß╗úc `decorateFoods`
  (`user/pricing/service.ts`) ─æiß╗ün `discountedPrice`, `discountAmount`, `discountPercent`,
  `discountLabel`; client chß╗ë hiß╗çn.
  ─É├óy l├á gi├í tham khß║úo c├╣ng luß║¡t vß╗¢i giß╗Å, c├▓n con sß╗æ chß╗æt vß║½n l├á b├ío gi├í.

### 5. Trß╗ú l├╜ AI t╞░ vß║Ñn m├│n (chß╗æng bß╗ïa m├│n/gi├í)

Trß╗ú l├╜ AI d├╣ng **hai l╞░ß╗út gß╗ìi AI, bß╗æn b╞░ß╗¢c xß╗¡ l├╜** ─æß╗â AI kh├┤ng bao giß╗¥ tß╗▒ ngh─⌐ ra m├│n hoß║╖c gi├í:

```
Ng╞░ß╗¥i d├╣ng ΓåÆ (1) AI tr├¡ch xuß║Ñt ti├¬u ch├¡ (JSON)   [lib/gemini.ts, jsonMode]
           ΓåÆ (2) Server truy vß║Ñn DB, lß╗ìc m├│n bß║▒ng code x├íc ─æß╗ïnh
           ΓåÆ (3) AI viß║┐t c├óu trß║ú lß╗¥i dß╗▒a TR├èN DANH S├üCH M├ôN THß║¼T
           ΓåÆ (4) Thß║╗ m├│n trß║ú vß╗ü client lß║Ñy ID/gi├í tß╗½ DB, kh├┤ng tß╗½ text AI
```

- L╞░ß╗út AI ─æß║ºu ti├¬n tr├¡ch xuß║Ñt ti├¬u ch├¡ d╞░ß╗¢i dß║íng JSON; server lß╗ìc `Food` bß║▒ng code v├á chß╗ë
  d├╣ng c├íc m├│n ─æang phß╗Ñc vß╗Ñ.
- L╞░ß╗út AI thß╗⌐ hai viß║┐t c├óu trß║ú lß╗¥i tß╗½ danh s├ích m├│n ─æ├ú lß╗ìc. Danh s├ích gß╗¡i v├áo prompt bß╗ï
  giß╗¢i hß║ín 15 m├│n; sß╗æ thß║╗ trß║ú vß╗ü mß╗ùi l╞░ß╗út lu├┤n nß║▒m trong **1..5**. Cß║Ñu h├¼nh `max_suggestions`
  trong trang Chatbot bß╗ï kß║╣p vß╗ü khoß║úng n├áy, n├¬n gi├í trß╗ï c┼⌐ 8/10 c┼⌐ng kh├┤ng v╞░ß╗út 5.
- Thß║╗ m├│n ph├¡a client ─æ╞░ß╗úc dß╗▒ng tß╗½ danh s├ích m├│n ─æ├ú lß╗ìc (mß║úng `foods` trong `ChatResponse`), n├¬n ID v├á
  gi├í kh├┤ng lß║Ñy tß╗½ c├óu trß║ú lß╗¥i AI. Thß║╗ mang th├¬m `portions` v├á `totalPrice` do server t├¡nh, n├¬n gi├í
  hiß╗ân thß╗ï khß╗¢p vß╗¢i tß╗òng tiß╗ün kh├ích sß║╜ phß║úi trß║ú.
- `lib/gemini.ts` ─æß╗ìc nh├á cung cß║Ñp v├á t├¬n m├┤ h├¼nh tß╗½ bß║úng cß║Ñu h├¼nh `ai_setting` (quß║ún trß╗ï vi├¬n ─æß║╖t
  trong trang Chatbot), chß╗ë fallback vß╗ü `AI_PROVIDER` / `AI_MODEL` khi ch╞░a ─æß║╖t. Cß║ú
  Gemini v├á OpenAI ─æß╗üu ─æ╞░ß╗úc hß╗ù trß╗ú; `fetch REST` c├│ timeout 15 gi├óy cho cß║ú kß║┐t nß╗æi v├á ─æß╗ìc.
- **Ngß╗» cß║únh hß╗Åi tiß║┐p nß║▒m ß╗ƒ client, kh├┤ng l╞░u v├áo CSDL.** `chatSchema` (`user/chatbot/routes.ts`)
  nhß║¡n th├¬m `history`
  (tß╗æi ─æa 3 c├óu hß╗Åi gß║ºn nhß║Ñt) v├á `lastFoodIds` (ID c├íc m├│n ß╗ƒ tin bot gß║ºn nhß║Ñt). Client xo├í
  `foods` cß╗ºa mß╗ìi tin bot c┼⌐ n├¬n chß╗ë tin mß╗¢i nhß║Ñt c├▓n thß║╗; ref `lastFoodIds` ─æ╞░ß╗úc cß║¡p nhß║¡t theo
  tin ─æ├│ v├á clear khi tin mß╗¢i kh├┤ng c├│ m├│n.
- `history` ─æ╞░ß╗úc ─æ╞░a v├áo prompt tr├¡ch xuß║Ñt ti├¬u ch├¡ d╞░ß╗¢i nh├ún "C├éU Hß╗ÄI TR╞»ß╗ÜC Cß╗ªA KH├üCH" ─æß╗â AI
  hiß╗âu "m├│n ─æ├│", "m├│n vß╗½a gß╗úi ├╜". Server kh├┤ng tß╗▒ ─æß╗ìc `chat_message`; ngß╗» cß║únh chß╗ë ─æß║┐n tß╗½
  client hoß║╖c tß╗½ `lastFoodIds`.
- `lastFoodIds` chß╗ë ─æ╞░ß╗úc d├╣ng khi c├óu mß╗¢i l├á hß╗Åi tiß║┐p thß║¡t sß╗▒: c├│ cß╗Ñm tham chiß║┐u r├╡ ("m├│n ─æ├│",
  "c├íi ─æ├│", "m├│n n├áy", "m├│n vß╗½a gß╗úi ├╜", "mß║Ñy m├│n tr├¬n", "trong sß╗æ ─æ├│") **v├á** ti├¬u ch├¡ kh├┤ng mß╗ƒ
  chß╗º ─æß╗ü mß╗¢i (`categories`, `keywords`, `dietaryTags`, `excludeAllergens` ─æß╗üu rß╗ùng). Khi ─æ├│
  server lß║Ñy ─æ├║ng c├íc `Food` theo ID rß╗ôi ├íp r├áng buß╗Öc mß╗¢i (cay, ng├ón s├ích, sß╗æ ng╞░ß╗¥i). C├óu mß╗ƒ
  chß╗º ─æß╗ü mß╗¢i bß╗Å qua context v├á t├¼m tr├¬n to├án thß╗▒c ─æ╞ín. Kh├┤ng d├╣ng ─æß╗Ö d├ái c├óu ─æß╗â ─æo├ín hß╗Åi tiß║┐p.
  Nh├ính dß╗▒ ph├▓ng khi AI lß╗ùi c┼⌐ng b├ím `lastFoodIds` nß║┐u c├óu l├á hß╗Åi tiß║┐p.
- Lß╗ùi AI/JSON sai th├¼ xß╗¡ l├╜ bß║▒ng `try/catch` ΓåÆ hß╗ç thß╗æng vß║½n chß║íy b├¼nh th╞░ß╗¥ng. JSON AI trß║ú vß╗ü c├│
  thß╗â c├│ th├¬m tr╞░ß╗¥ng lß║í; zod schema d├╣ng `.loose()` n├¬n bß╗Å qua ch├║ng, mß╗Öt tr╞░ß╗¥ng
  thß╗½a kh├┤ng l├ám mß║Ñt gß╗úi ├╜.
- **Thiß║┐u hoß║╖c hß╗Ång kh├│a API**: `lib/gemini.ts isConfigured()` kiß╗âm tra `AI_API_KEY`; nß║┐u rß╗ùng,
  `chat()` n├⌐m `503 SERVICE_UNAVAILABLE` vß╗¢i c├óu "Trß╗ú l├╜ AI ch╞░a ─æ╞░ß╗úc cß║Ñu h├¼nh, vui l├▓ng thß╗¡
  lß║íi sau." ngay tr╞░ß╗¢c khi l╞░u c├óu hß╗Åi, n├¬n kh├┤ng c├│ lß╗ïch sß╗¡ r├íc v├á kh├┤ng tß╗æn thß╗¥i gian chß╗¥
  timeout. `GET /api/chatbot/status` trß║ú `{ available, notice }` ─æß╗â client biß║┐t tr╞░ß╗¢c: khung chat
  hiß╗çn banner ─æ├║ng c├óu tr├¬n, ├┤ nhß║¡p v├á n├║t gß╗¡i bß╗ï kh├│a.
- **Kh├│a bß╗ï nh├á cung cß║Ñp tß╗½ chß╗æi** (401/403, hoß║╖c 400 k├¿m `API_KEY_INVALID` cß╗ºa Gemini) c┼⌐ng bß╗ï
  coi l├á ch╞░a cß║Ñu h├¼nh. `gemini.ts verifyKey()` (─æ╞░ß╗úc `/status` gß╗ìi) thß╗¡ mß╗Öt c├óu tß╗æi giß║ún ß╗ƒ lß║ºn
  ─æß║ºu rß╗ôi nhß╗¢ kß║┐t quß║ú, n├¬n mß╗ƒ trang l├á banner hiß╗çn ngay; lß╗ùi mß║íng/quota th├¼ coi nh╞░ d├╣ng ─æ╞░ß╗úc v├á
  chß╗ë thß╗¡ lß║íi sau 5 ph├║t. Khi bß╗ï tß╗½ chß╗æi, `lib/gemini.ts` bß║¡t cß╗¥ d├¡nh (`credentialsRejected`, giß╗» tß╗¢i
  khi khß╗ƒi ─æß╗Öng lß║íi) v├á `AiKeyRejectedException` ─æ╞░ß╗úc ─æß║⌐y xuy├¬n qua
  `extractCriteria`/`generateReply` ─æß╗â `chat()` ─æß╗òi th├ánh 503 thay v├¼ dß╗▒ng c├óu trß║ú lß╗¥i dß╗▒ ph├▓ng.
  Lß╗ùi 429/5xx, hß║┐t thß╗¥i gian chß╗¥ mß╗¢i ─æi nh├ính dß╗▒ ph├▓ng.
- **Nh├ính dß╗▒ ph├▓ng khi kh├┤ng gß╗ìi ─æ╞░ß╗úc AI** (429/5xx, JSON sai, hß║┐t thß╗¥i gian chß╗¥): `chat()`
  r╞íi sang `user/chatbot/select.ts` (`selectFoodsByCode` + `fallbackReply`). M├│n ─æ╞░ß╗úc chß║Ñm ─æiß╗âm bß║▒ng code
  theo tß╗½ kho├í tr├╣ng t├¬n m├│n/nguy├¬n liß╗çu/nh├ún, t├¬n danh mß╗Ñc chß╗ë t├¡nh khi c├óu hß╗Åi c├│ nguy├¬n cß╗Ñm
  t├¬n danh mß╗Ñc, rß╗ôi ├íp c├íc r├áng buß╗Öc ─æß╗ìc ─æ╞░ß╗úc chß║»c chß║»n tß╗½ c├óu (kh├┤ng cay, chay, loß║íi trß╗½ hß║úi
  sß║ún, ng├ón s├ích, sß╗æ ng╞░ß╗¥i). C├óu trß║ú lß╗¥i chß╗ë t├│m tß║»t mß╗Öt d├▓ng ("M├¼nh t├¼m ─æ╞░ß╗úc 5 m├│n chay, kh├┤ng
  cay, gi├í tß╗½ 35.000─æ.") rß╗ôi mß╗¥i kh├ích bß║Ñm thß║╗ m├│n, **kh├┤ng** liß╗çt k├¬ lß║íi danh s├ích m├│n v├¼
  thß║╗ m├│n ─æ├ú hiß╗çn ngay d╞░ß╗¢i. C├óu hß╗Åi ngo├ái lß╗ü th├¼ kh├┤ng gß╗úi ├╜ m├│n n├áo. Thß║╗ m├│n vß║½n lß║Ñy
  ID/gi├í tß╗½ CSDL n├¬n kh├┤ng c├│ chuyß╗çn AI bß╗ïa m├│n.
- Prompt cß╗ºa l╞░ß╗út ghi c├óu trß║ú lß╗¥i c├│ luß║¡t sß╗æ 9: AI c┼⌐ng kh├┤ng ─æ╞░ß╗úc liß╗çt k├¬ lß║íi danh s├ích m├│n,
  ─æß╗â c├óu trß║ú lß╗¥i cß╗ºa hai nh├ính (AI v├á dß╗▒ ph├▓ng) nh├¼n giß╗æng nhau.
- **Chß╗ë kh├ích ─æ├ú ─æ─âng nhß║¡p mß╗¢i l╞░u lß╗ïch sß╗¡ hß╗Öi thoß║íi.** Kh├ích v├úng lai vß║½n chat ─æ╞░ß╗úc nh╞░ng
  tin nhß║»n kh├┤ng ghi v├áo `chat_message`, n├¬n lß╗ïch sß╗¡ trong trang quß║ún trß╗ï lu├┤n gß║»n vß╗¢i t├ái khoß║ún.
- **Giß║úi quyß║┐t ─æß║íi tß╗½ tham chiß║┐u**: khi c├óu hß╗Åi c├│ cß╗Ñm tham chiß║┐u r├╡ ("m├│n ─æ├│", "c├íi ─æ├│", "m├│n n├áy",
  "m├│n vß╗½a gß╗úi ├╜", "mß║Ñy m├│n tr├¬n", "trong sß╗æ ─æ├│") v├á client gß╗¡i `lastFoodIds`, server tra t├¬n c├íc
  m├│n ─æ├│ (─æß╗ìc thß║│ng bß║úng `foods` theo ID) v├á gh├⌐p v├áo c├óu hß╗Åi tr╞░ß╗¢c khi tr├¡ch ti├¬u ch├¡; kh├┤ng d├╣ng
  bß╗Ö nhß╗¢ theo `sessionId` ph├¡a server.
- **Validate ti├¬u ch├¡**: `normalizeCriteria` loß║íi bß╗Å gi├í trß╗ï v├┤ l├╜ (─æß╗Ö cay ngo├ái 0ΓÇô3, ng├ón s├ích Γëñ 0, sß╗æ ng╞░ß╗¥i Γëñ 0/>50, chuß╗ùi rß╗ùng) v├á bß╗Å tß╗½ kh├│a tham chiß║┐u thuß║ºn ("m├│n ─æ├│"...). Nß║┐u bß╗Ö lß╗ìc tß╗½ kh├│a kh├┤ng khß╗¢p m├│n n├áo, server bß╗Å lß╗ìc tß╗½ kh├│a nh╞░ng vß║½n giß╗» c├íc r├áng buß╗Öc thuß╗Öc t├¡nh, tr├ính trß║ú danh s├ích rß╗ùng v├┤ l├╜.
- **RAG cho th├┤ng tin qu├ín:** bß║úng `chatbot_knowledge` l╞░u t├ái liß╗çu do admin nhß║¡p ß╗ƒ tab T├ái liß╗çu
  (`/admin/chatbot`), bß║úng `chatbot_knowledge_chunk` l╞░u c├íc ─æoß║ín v─ân bß║ún sau khi chia nhß╗Å k├¿m cß╗Öt
  `search_vector tsvector GENERATED ALWAYS AS (...) STORED` v├á index `GIN` (─æ╞░ß╗úc th├¬m bß║▒ng SQL trong
  migration, Drizzle hß╗ù trß╗ú truy vß║Ñn trß╗▒c tiß║┐p bß║▒ng tag `sql`). Admin tß║úi l├¬n PDF/DOCX/TXT/MD,
  `user/chatbot/documentParser.ts` t├ích text (pdf-parse/mammoth), chia nhß╗Å theo ─æoß║ín, `documentParser`/`ingest`
  l╞░u chunk. Bot tra **tsvector + tß╗½ kh├│a**: t├¼m bß║▒ng `websearch_to_tsquery` (`ts_rank_cd`), kh├┤ng
  t├¼m thß║Ñy th├¼ chß║Ñm tß╗½ kh├│a nh╞░ chß║Ñm m├│n dß╗▒ ph├▓ng (c├│ unaccent/chuß║⌐n ho├í tiß║┐ng Viß╗çt 2 ─æß║ºu).
  C├óu trß║ú lß╗¥i chß╗ë tß╗½ ─æoß║ín t├¼m ─æ╞░ß╗úc, k├¿m `citations` hiß╗çn "Nguß╗ôn: ...". Kh├┤ng t├¼m thß║Ñy th├¼ n├│i kh├┤ng r├╡,
  kh├┤ng bß╗ïa giß╗¥/gi├í ship. M├│n ─ân vß║½n lß╗ìc bß║▒ng code x├íc ─æß╗ïnh, kh├┤ng ─æ╞░a gi├í/cay/khß║ú dß╗Ñng v├áo bß║úng RAG.
- **─Éß╗ïnh tuyß║┐n intent:** `user/chatbot/service.ts` chia c├óu hß╗Åi th├ánh `FOOD`,
  `RESTAURANT_INFO`, `ORDER_GUIDE`, `OUT_OF_SCOPE` bß║▒ng c├íc h├ám cß╗Ñc bß╗Ö `isRestaurantInfoQuestion`,
  `isOrderGuideQuestion` v├á `genericInfoMatch`. Keyword ─æ╞░ß╗úc thß╗¡ tr╞░ß╗¢c (kh├┤ng tß╗æn mß║íng);
  kh├┤ng khß╗¢p g├¼ mß╗¢i tra t├ái liß╗çu mß╗Öt lß║ºn ΓÇö c├óu khß╗¢p th├¼ coi l├á `RESTAURANT_INFO` (d├╣ng
  lu├┤n c├íc ─æoß║ín ─æ├ú tra cho c├óu trß║ú lß╗¥i), kh├┤ng khß╗¢p th├¼ `OUT_OF_SCOPE`. `RESTAURANT_INFO` v├á
  `ORDER_GUIDE` trß║ú lß╗¥i bß║▒ng t├ái liß╗çu/quy tr├¼nh cß╗æ ─æß╗ïnh (kh├┤ng gß╗ìi AI), `ORDER_GUIDE` kh├┤ng tr├¡ch
  dß║½n t├ái liß╗çu, `OUT_OF_SCOPE` tß╗½ chß╗æi lß╗ïch sß╗▒, `FOOD` mß╗¢i ─æi hai l╞░ß╗út AI.
- **Follow-up tß╗½ng b╞░ß╗¢c cho ng╞░ß╗¥i mß╗¢i:** nß║┐u c├óu gß╗úi ├╜ m├│n qu├í chung (thiß║┐u cß║ú sß╗æ ng╞░ß╗¥i v├á ng├ón s├ích,
  ch╞░a nhß║»c chay/cay/dß╗ï ß╗⌐ng, kh├┤ng nhß║»c t├¬n m├│n cß╗Ñ thß╗â) th├¼ bot hß╗Åi `Bß║ín ─æang muß╗æn ─ân cho mß║Ñy ng╞░ß╗¥i?`
  tr╞░ß╗¢c khi trß║ú m├│n. C├óu c├│ r├áng buß╗Öc (chay/cay/dß╗ï ß╗⌐ng) hoß║╖c kh├ích n├│i `t├╣y bß║ín` th├¼ gß╗úi ├╜ ngay,
  kh├┤ng tra hß╗Åi. Server giß╗» c├óu hß╗Åi gß╗æc theo `sessionId` (hß║┐t hß║ín sau 10 ph├║t): nß║┐u l╞░ß╗út sau kh├ích
  trß║ú lß╗¥i vß║»n tß║»t ("2", "2 ng╞░ß╗¥i", "200k") th├¼ c├óu trß║ú lß╗¥i ─æ╞░ß╗úc gh├⌐p vß╗¢i c├óu hß╗Åi gß╗æc tr╞░ß╗¢c khi
  ph├ón loß║íi FOOD, v├á r├áng buß╗Öc ─æß╗ìc ─æ╞░ß╗úc (sß╗æ ng╞░ß╗¥i, ng├ón s├ích) ─æ╞░ß╗úc ├⌐p v├áo ti├¬u ch├¡; kh├ích hß╗Åi c├óu
  kh├íc th├¼ ngß╗» cß║únh chß╗¥ bß╗ï bß╗Å.
- **Quick replies theo tß╗½ng l╞░ß╗út:** mß╗ùi `ChatResponse` k├¿m `quickReplies` do server quyß║┐t ─æß╗ïnh theo
  t├¼nh huß╗æng ΓÇö FOOD c├│ thß║╗: `M├│n kh├íc`, `M├│n chay kh├┤ng cay`, `C├ích ─æß║╖t m├│n thß║┐ n├áo?`; FOOD rß╗ùng:
  `M├│n kh├íc`, `M├│n chay kh├┤ng cay`; bot hß╗Åi follow-up: `1 ng╞░ß╗¥i`/`2 ng╞░ß╗¥i`/`4 ng╞░ß╗¥i`;
  RESTAURANT_INFO/ORDER_GUIDE/OUT_OF_SCOPE: lß╗æi v├áo gß╗úi ├╜ m├│n/─æß║╖t h├áng/giß╗¥ mß╗ƒ cß╗¡a. Mß╗Öt l╞░ß╗út
  kh├┤ng v╞░ß╗út qu├í 3 n├║t. Bß║Ñm n├║t =
  gß╗¡i ─æ├║ng text ─æ├│ nh╞░ kh├ích tß╗▒ g├╡; client render d╞░ß╗¢i tin bot mß╗¢i nhß║Ñt (tin c┼⌐ bß╗ï t╞░ß╗¢c
  `quickReplies` giß╗æng `foods`). N├║t `M├│n kh├íc` do server xß╗¡ l├╜ bß║▒ng code ΓÇö chß╗ìn m├│n ─æang phß╗Ñc vß╗Ñ
  ngoß║íi trß╗½ c├íc ID vß╗½a hiß╗ân thß╗ï, gi├í t─âng dß║ºn, kh├┤ng gß╗ìi AI. Prompt trß║ú lß╗¥i c├│ th├¬m luß║¡t 10
  (giß║úi th├¡ch ngß║»n gß╗ìn v├¼ sao c├íc m├│n hß╗úp vß╗¢i y├¬u cß║ºu cß╗ºa kh├ích); prompt nß║▒m ß╗ƒ
  `user/chatbot/prompts.ts`,
  dß╗▒ ├ín tß╗▒ thiß║┐t kß║┐ theo nghiß╗çp vß╗Ñ ─æß║╖t m├│n, kh├┤ng bß║ún sao prompt mß║½u cß╗ºa repo n├áo.
- **Streaming chß╗»:** server vß║½n trß║ú nguy├¬n c├óu vß╗ü mß╗Öt lß║ºn, client chß║íy chß╗» dß║ºn theo tß╗½
  (`useChatConversation`), c├│ status text `─Éang t├¼m m├│n...` / `─Éang tra t├ái liß╗çu qu├ín...` v├á n├║t Dß╗½ng.
  Widget nß╗òi d├╣ng mß╗Öt session duy nhß║Ñt: `sessionId`/`messages` l╞░u qua `localStorage`,
  l├ám mß╗¢i hß╗Öi thoß║íi th├¼ cß║Ñp `sessionId` mß╗¢i.

#### Bß╗æn kiß╗âu t╞░ vß║Ñn v├á c├ích server lß╗ìc

Ti├¬u ch├¡ AI trß║ú vß╗ü gß╗ôm `categories` (loß║íi m├│n v├á sß╗æ m├│n mong muß╗æn cho tß╗½ng loß║íi),
`maxSpicyLevel`, `maxBudget` (Tß╗öNG ng├ón s├ích cß╗ºa cß║ú bß╗»a), `people`, `excludeAllergens`,
`dietaryTags` v├á `keywords`. `user/chatbot/select.ts (selectFoods)` ├íp ch├║ng bß║▒ng code, theo hai b╞░ß╗¢c:

1. **Lß╗ìc thuß╗Öc t├¡nh m├│n**: c├▓n phß╗Ñc vß╗Ñ, ─æß╗Ö cay, th├ánh phß║ºn loß║íi trß╗½ (qu├⌐t cß║ú `allergens` lß║½n
   `ingredients`), nh├ún chß║┐ ─æß╗Ö ─ân, tß╗½ kh├│a. Danh mß╗Ñc v├á gi├í ─æß╗â d├ánh cho b╞░ß╗¢c 2.
2. **Chß╗ìn m├│n theo ng├ón s├ích** (`maxBudget` l├á Tß╗öNG cß╗ºa cß║ú bß╗Ö gß╗úi ├╜):
   - *Mß╗Öt loß║íi m├│n* (hoß║╖c kh├ích kh├┤ng n├│i r├╡ loß║íi n├áo): `FlatBudgetPicker` d├▓ tß╗ò hß╗úp tr├¬n tß╗æi
     ─æa 20 m├│n rß║╗ nhß║Ñt (bß╗Å tr├╣ng theo ID), chß╗ìn 1..5 m├│n sao cho `sum(totalPrice) <= maxBudget`
     v├á tß╗òng tiß╗ün lß╗¢n nhß║Ñt; ho├á tß╗òng th├¼ ╞░u ti├¬n nhiß╗üu m├│n h╞ín. Kh├┤ng c├│ bß╗Ö n├áo vß╗½a th├¼ trß║ú
     rß╗ùng v├á c├óu trß║ú lß╗¥i n├│i r├╡ ch╞░a c├│ m├│n trong ng├ón s├ích.
   - *Kß║┐t hß╗úp nhiß╗üu loß║íi* ("mß╗Öt m├│n ch├¡nh v├á mß╗Öt m├│n uß╗æng"): mß╗ùi loß║íi giß╗» 5 ß╗⌐ng vi├¬n rß║╗ nhß║Ñt
     rß╗ôi `BudgetCombiner` d├▓ tß╗ò hß╗úp, giß╗» ─æ├║ng sß╗æ m├│n mß╗ùi nh├│m v├á tß╗òng kh├┤ng v╞░ß╗út ng├ón s├ích.
     Kh├┤ng gh├⌐p ─æ╞░ß╗úc th├¼ trß║ú rß╗ùng, kh├┤ng lß║Ñy lß╗çch loß║íi m├│n kh├ích y├¬u cß║ºu.
   - Kh├┤ng c├│ `maxBudget`: giß╗» h├ánh vi c┼⌐, trß║ú danh s├ích ß╗⌐ng vi├¬n v├á `chat()` cß║»t c├▓n tß╗æi ─æa 5.

**Sß╗æ ng╞░ß╗¥i ─ân v├á khß║⌐u phß║ºn**: sß╗æ phß║ºn cß║ºn cß╗ºa mß╗Öt m├│n l├á `ceil(people / khß║⌐u phß║ºn)`, v├¡ dß╗Ñ
4 ng╞░ß╗¥i ─ân, m├│n phß╗Ñc vß╗Ñ 2 ng╞░ß╗¥i th├¼ cß║ºn 2 phß║ºn. Tß╗òng tiß╗ün cß╗ºa m├│n l├á `gi├í ├ù sß╗æ phß║ºn`, v├á
ng├ón s├ích so vß╗¢i **tß╗òng** sß╗æ phß║ºn chß╗⌐ kh├┤ng phß║úi gi├í mß╗Öt phß║ºn. Sß╗æ phß║ºn v├á tß╗òng tiß╗ün ─æ╞░ß╗úc
ghi k├¿m v├áo prompt ─æß╗â AI ─æß╗ìc lß║íi thay v├¼ tß╗▒ t├¡nh, v├á gß╗¡i k├¿m thß║╗ m├│n ra client.

Nß║┐u kh├┤ng tß╗ò hß╗úp n├áo vß╗½a ng├ón s├ích (kß╗â cß║ú khi sß╗æ ng╞░ß╗¥i l├ám sß╗æ phß║ºn t─âng), server trß║ú danh s├ích
rß╗ùng v├á c├óu trß║ú lß╗¥i n├│i r├╡ ch╞░a c├│ m├│n trong ng├ón s├ích; kh├┤ng tß╗▒ bß╗Å yß║┐u tß╗æ sß╗æ ng╞░ß╗¥i v├¼ nh╞░ vß║¡y
gi├í hiß╗ân thß╗ï sß║╜ lß╗çch vß╗¢i sß╗æ ng╞░ß╗¥i kh├ích n├│i. Tß╗òng bß╗Ö gß╗úi ├╜ v├á ng├ón s├ích ─æ╞░ß╗úc ghi v├áo prompt
trß║ú lß╗¥i (`Tß╗öNG Bß╗ÿ Gß╗óI ├¥`, `NG├éN S├üCH`) ─æß╗â AI kh├┤ng n├│i sai, v├á `fallbackReply` c┼⌐ng t├│m tß║»t
dß║íng "N m├│n, tß╗òng ... trong ng├ón s├ích ...".

### 5b. ß║ónh m├│n do admin tß║úi l├¬n

- `POST /api/admin/uploads/image` nhß║¡n JPG/PNG/WEBP tß╗æi ─æa 2 MB. ─Éß╗ïnh dß║íng ─æ╞░ß╗úc x├íc ─æß╗ïnh bß║▒ng
  **chß╗» k├╜ ─æß║ºu file**, kh├┤ng tin `Content-Type` do client khai.
- File nß║▒m ß╗ƒ th╞░ mß╗Ñc `UPLOAD_DIR` (mß║╖c ─æß╗ïnh `uploads`, `/app/uploads` trong container), mount th├ánh volume `uploads` trong
  `docker-compose.yml`, v├á ─æ╞░ß╗úc phß╗Ñc vß╗Ñ lß║íi qua `express.static` tß║íi ─æ╞░ß╗¥ng dß║½n `/api/uploads/**`.
- Endpoint trß║ú vß╗ü **URL tuyß╗çt ─æß╗æi** dß╗▒ng tß╗½ host cß╗ºa request, nhß╗¥ vß║¡y ß║únh hiß╗ân thß╗ï ─æ╞░ß╗úc ß╗ƒ cß║ú dev (Vite ß╗ƒ cß╗òng kh├íc) lß║½n bß║ún build qua nginx m├á kh├┤ng phß║úi sß╗¡a cß║Ñu h├¼nh proxy.

### 6. ─É├ính gi├í v├á ─æß║╖t lß║íi

- Kh├ích chß╗ë ─æ╞░ß╗úc ─æ├ính gi├í m├│n c├│ trong **─æ╞ín ho├án th├ánh** cß╗ºa ch├¡nh m├¼nh
  (truy vß║Ñn nß╗æi `orders` vß╗¢i `order_items` trong `review` module), khß╗¢p y├¬u cß║ºu "─æ├ính gi├í sau khi d├╣ng".
- Nß╗Öi dung nhß║¡n x├⌐t **kh├┤ng bß║»t buß╗Öc**: kh├ích c├│ thß╗â chß╗ë chß╗ìn sß╗æ sao. `review` module (normalizeComment)
  chuß║⌐n h├│a
  chuß╗ùi rß╗ùng hoß║╖c chß╗ë khoß║úng trß║»ng th├ánh `null` ß╗ƒ cß║ú tß║ío v├á sß╗¡a; cß╗Öt `comment` vß╗æn ─æ├ú nullable n├¬n
  kh├┤ng cß║ºn ─æß╗òi CSDL.
- `GET /api/reviews/food/{foodId}` trß║ú k├¿m cß╗¥ `mine` ─æß╗â client biß║┐t ─æ├ính gi├í n├áo cß╗ºa ch├¡nh
  m├¼nh v├á chß╗ë hiß╗çn n├║t Sß╗¡a/X├│a ß╗ƒ ─æ├║ng ─æ├ính gi├í ─æ├│. `PUT` v├á `DELETE /api/reviews/{id}` ─æß╗üu kiß╗âm
  tra chß╗º sß╗ƒ hß╗»u ß╗ƒ server, kh├┤ng tin cß╗¥ `mine` tß╗½ client.
- Trang lß╗ïch sß╗¡ ─æ╞ín c├│ n├║t **─Éß║╖t lß║íi** (chß╗ë render khi ─æ╞ín `COMPLETED` theo ─æiß╗üu kiß╗çn trong
  `OrdersPage`): ─æ╞░a to├án bß╗Ö m├│n (c├▓n phß╗Ñc vß╗Ñ) cß╗ºa ─æ╞ín c┼⌐ v├áo giß╗Å, m├│n ngß╗½ng phß╗Ñc vß╗Ñ bß╗ï bß╗Å qua
  k├¿m cß║únh b├ío, rß╗ôi mß╗ƒ drawer giß╗Å tß║íi chß╗ù. N├║t **Hß╗ºy ─æ╞ín** ─æi qua helper `canCancelOrder`
  (`client/src/shared/utils/orders.ts`) c├╣ng r├áng buß╗Öc vß╗¢i `order` module (cancelOrder): ─æ╞ín `PENDING` ch╞░a
  thanh to├ín; ─æ╞ín `PENDING` ─æ├ú `PAID` thay n├║t bß║▒ng gß╗úi ├╜ gß╗ìi hotline.

### 7. Th├┤ng b├ío

- Tß╗½ `lg` chu├┤ng l├á n├║t ri├¬ng tr├¬n header (mang chß║Ñm ─æß╗Å ch╞░a ─æß╗ìc), d╞░ß╗¢i `lg` mß╗Ñc "Th├┤ng b├ío" nß║▒m
  trong menu t├ái khoß║ún; cß║ú hai ─æß╗üu mß╗ƒ
  `NotificationsDrawer` b├¬n phß║úi. Avatar c├│ chß║Ñm ─æß╗Å khi c├▓n th├┤ng b├ío ch╞░a ─æß╗ìc; sß╗æ ch╞░a ─æß╗ìc
  c┼⌐ng hiß╗çn cß║ính nh├ún trong menu. `user/notification/store.ts` l├á nguß╗ôn dß╗» liß╗çu chung cho cß║ú
  header v├á drawer, tr╞░ß╗¢c ─æ├óy hai n╞íi gß╗ìi API ri├¬ng n├¬n dß╗à lß╗çch sß╗æ.
- Mß╗ùi th├┤ng b├ío gß║»n `orderId` nullable cß╗ºa ─æ╞ín li├¬n quan, do `order` module (notify) set;
  tß╗½ migration `init` mß╗ìi th├┤ng b├ío ─æß╗üu c├│ thß╗â c├│ `orderId`.
- C├íc thao t├íc giß╗» nguy├¬n mß╗Öt bß╗Ö endpoint: `POST /api/notifications/read-all`,
  `POST /api/notifications/{id}/read`, `DELETE /api/notifications/read` (x├│a c├íc th├┤ng b├ío ─æ├ú ─æß╗ìc)
  v├á `DELETE /api/notifications/{id}`. Endpoint thao t├íc mß╗Öt th├┤ng b├ío kiß╗âm tra chß╗º sß╗ƒ hß╗»u nh╞░
  x├│a: 404 khi kh├┤ng tß╗ôn tß║íi, 403 khi cß╗ºa ng╞░ß╗¥i kh├íc.
- Bß║Ñm v├áo th├ón th├┤ng b├ío: ─æ├ính dß║Ñu ─æ├ú ─æß╗ìc, ─æ├│ng drawer, v├á nß║┐u c├│ `orderId` th├¼ ─æiß╗üu h╞░ß╗¢ng
  `/orders?orderId=...`; trang ─æ╞ín cuß╗Ön tß╗¢i thß║╗ `order-{id}` v├á t├┤ ring ─æß╗â chß╗ë ─æ├║ng ─æ╞ín. Th├┤ng b├ío
  c┼⌐ kh├┤ng c├│ `orderId` chß╗ë mark read rß╗ôi ─æ├│ng drawer.
- N├║t "X├│a ─æ├ú ─æß╗ìc" x├│a mß╗ìi th├┤ng b├ío `read = true` cß╗ºa ch├¡nh ng╞░ß╗¥i d├╣ng. N├║t x├│a tß╗½ng th├┤ng b├ío
  lu├┤n hiß╗çn tr├¬n mobile, c├▓n desktop chß╗ë hiß╗çn khi hover hoß║╖c focus.

## Giao diß╗çn kh├ích h├áng v├á giao diß╗çn quß║ún trß╗ï

Hai nh├│m d├╣ng hai layout ri├¬ng, ─æ├║ng y├¬u cß║ºu "t├ích ri├¬ng trang quß║ún trß╗ï vß╗¢i trang kh├ích h├áng":

- `DefaultLayout` bß╗ìc route kh├ích: thanh ─æiß╗üu h╞░ß╗¢ng, `CartDrawer`, `NotificationsDrawer` v├á
  khung chatbot nß╗òi, kh├┤ng c├│ ch├ón trang. Chiß╗üu cao header nß║▒m ß╗ƒ biß║┐n `--header-h`; trang thß╗▒c
  ─æ╞ín kho├í `calc(100dvh - var(--header-h))` v├á cuß╗Ön trong v├╣ng ri├¬ng, c├íc trang c├▓n lß║íi cuß╗Ön
  theo t├ái liß╗çu.
- `AdminLayout` bß╗ìc `/admin/*`: menu tr├íi chia nh├│m B├ín h├áng (Tß╗òng quan, ─É╞ín h├áng, Kh├ích h├áng),
  Thß╗▒c ─æ╞ín (M├│n ─ân, Danh mß╗Ñc), Marketing (Khuyß║┐n m├úi), Hß╗ç thß╗æng (Chatbot, B├ío c├ío);
  thu gß╗ìn th├ánh drawer ß╗ƒ m├án h├¼nh nhß╗Å. V├áo `/admin` mß║╖c ─æß╗ïnh mß╗ƒ `/admin/dashboard`. Route admin
  kh├┤ng nß║▒m trong `DefaultLayout`, n├¬n kh├┤ng c├│ khung chatbot hay thanh ─æiß╗üu h╞░ß╗¢ng cß╗ºa kh├ích.

### Trang tß╗òng quan quß║ún trß╗ï

`/admin/dashboard` l├á trang mß╗ƒ ─æß║ºu cß╗ºa khu quß║ún trß╗ï v├á cß╗æ ├╜ **kh├┤ng** d├╣ng thß║╗ m├áu m├¿ hay biß╗âu
─æß╗ô cß║ºu kß╗│: mß╗Öt h├áng chß╗ë sß╗æ ng─ân bß║▒ng ─æ╞░ß╗¥ng kß║╗ mß║únh, danh s├ích ─æ╞ín chß╗¥ x├íc nhß║¡n k├¿m n├║t duyß╗çt
ngay tß║íi chß╗ù, v├á m├│n b├ín chß║íy vß╗¢i thanh mß╗Öt m├áu. Viß╗çc cß║ºn l├ám nß║▒m tr├¬n ─æß║ºu trang, sß╗æ liß╗çu lß║Ñy
tß╗½ `/api/admin/reports/*` t├¡nh trong 30 ng├áy gß║ºn nhß║Ñt. Doanh thu tr├¬n trang n├áy l├á doanh thu
**sau giß║úm gi├í**, khß╗¢p vß╗¢i trang B├ío c├ío, n├¬n hai n╞íi kh├┤ng bao giß╗¥ lß╗çch nhau.

### Trang thß╗▒c ─æ╞ín kiß╗âu kiosk

Trang chß╗º ch├¡nh l├á trang thß╗▒c ─æ╞ín (`/`), khß╗¢p Bß║úng 2.22 gß╗Öp "Trang chß╗º / Thß╗▒c ─æ╞ín" l├ám mß╗Öt
m├án h├¼nh. Cß║Ñu tr├║c tß╗½ tr├¬n xuß╗æng:

- **Hero** (`user/menu/components/HomeHero.vue`) trß║úi hß║┐t bß╗ü ngang v├╣ng cuß╗Ön, chß╗ë hiß╗çn khi ch╞░a c├│ bß╗Ö
  lß╗ìc. ß║ónh l├á `hero.webp` thß║¡t, phß╗º lß╗¢p tß╗æi ─æß╗â chß╗» trß║»ng ─æß║ít AA; nß╗Öi dung chß╗ë c├│ ti├¬u ─æß╗ü
  `H├┤m nay ─ân g├¼?` k├¿m hai n├║t `Xem thß╗▒c ─æ╞ín` v├á `Hß╗Åi trß╗ú l├╜ AI`. Cao 180/220/260px theo breakpoint.
- **Dß║úi danh mß╗Ñc** (`CategoryRail`) l├á chip cao 40px c├│ ß║únh tr├▓n 32px, cuß╗Ön ngang; chß╗ìn danh mß╗Ñc
  ghi `?category=` v├á cuß╗Ön tß╗¢i l╞░ß╗¢i m├│n.
- **╞»u ─æ├úi h├┤m nay** (`DealRail`) l├á shelf cuß╗Ön ngang d├╣ng chung `FoodCard` vß╗¢i l╞░ß╗¢i thß╗▒c ─æ╞ín,
  lß║Ñy tß╗æi ─æa 8 m├│n c├│ `discountPercent > 0` do server t├¡nh, k├¿m n├║t "Xem tß║Ñt cß║ú" bß║¡t bß╗Ö lß╗ìc
  `deal=1`. Kh├┤ng tß╗▒ ─æo├ín ch╞░╞íng tr├¼nh n├áo ─æang chß║íy. N├║t cß╗Öng tr├¬n ß║únh chß╗ë hiß╗çn khi hover
  (hoß║╖c lu├┤n hiß╗çn tr├¬n m├án kh├┤ng c├│ hover).
- **Sß║»p xß║┐p** nß║▒m ß╗ƒ h├áng ti├¬u ─æß╗ü thß╗▒c ─æ╞ín d╞░ß╗¢i dß║íng n├║t `Sß║»p xß║┐p: ΓÇª Γîä` mß╗ƒ Dropdown radio, kh├┤ng
  c├▓n Select full-width trong thanh sticky.
- **L╞░ß╗¢i m├│n** 2 cß╗Öt d╞░ß╗¢i `md`, 4 cß╗Öt tß╗½ `md` (`grid-cols-2 md:grid-cols-4`), ph├ón trang 12 m├│n
  mß╗ùi trang (`PAGE_SIZE` chia hß║┐t cho 2 v├á 4). Trang nß║▒m tr├¬n URL (`page`), ─æß╗òi bß╗Ö lß╗ìc vß╗ü trang 1.
- **Bß╗Ö lß╗ìc nß║▒m tr├¬n URL**: `category`, `keyword`, `min`, `max`, `sort`, `diet`, `spicy`,
  `available`, `deal`, `page`. Nhß╗¥ vß║¡y chia sß║╗ ─æ╞░ß╗úc ─æ╞░ß╗¥ng dß║½n ─æ├ú lß╗ìc, n├║t quay lß║íi giß╗» nguy├¬n trß║íng th├íi
  v├á ├┤ t├¼m kiß║┐m tr├¬n header ─æiß╗üu khiß╗ân ─æ╞░ß╗úc trang n├áy. Bß╗Ö lß╗ìc nhanh (C├▓n m├│n, M├│n chay, Kh├┤ng
  cay, ─Éang giß║úm) v├á 5 dß║úi gi├í lß╗ìc tr├¬n danh s├ích ─æ├ú tß║úi; sß║»p xß║┐p theo gi├í hoß║╖c mß╗⌐c giß║úm chß║íy
  tr├¬n client v├¼ dß╗» liß╗çu tß╗½ng m├│n ─æ├ú ─æß╗º.
- T├¼m kiß║┐m khß╗¢p **kh├┤ng dß║Ñu, kh├┤ng ph├ón biß╗çt hoa th╞░ß╗¥ng**: server chß╗ë ─æß║⌐y ─æiß╗üu kiß╗çn danh mß╗Ñc,
  khoß║úng gi├í xuß╗æng SQL rß╗ôi lß╗ìc tß╗½ kho├í bß║▒ng code qua `text-normalizer.ts` (NFD bß╗Å dß║Ñu, ─æ/─É ΓåÆ d)
  tr├¬n tß║¡p m├│n ─æ├ú tß║úi (`menu` module (searchFoods)) ΓÇö kh├┤ng cß║ºu extension `unaccent` cß╗ºa PostgreSQL.
  Enter trong ├┤ t├¼m kiß║┐m ├íp dß╗Ñng
  ngay qua `commitSearch` d├╣ng chung vß╗¢i debounce: ß╗ƒ `/` giß╗» nguy├¬n `category`/`min`/`max`,
  ß╗ƒ trang kh├íc th├¼ vß╗ü `/` k├¿m tß╗½ kho├í thay v├¼ l├ám rß╗ùng bß╗Ö lß╗ìc.

Thß║╗ m├│n giß╗» mß║¡t ─æß╗Ö c┼⌐: ß║únh 16:10, ─æß╗çm `p-2.5` tr├¬n mobile v├á `p-3` tß╗½ `sm`, tß╗æi ─æa 2 nh├ún.
Gi├í d├╣ng `food.discountedPrice ?? food.price` v├á hiß╗çn gi├í gß╗æc gß║ích ngang khi ─æang giß║úm. N├║t
tr├▓n chß╗ë c├│ icon dß║Ñu cß╗Öng tr├¬n ß║únh th├¬m nhanh, c├│ tooltip khi hover v├á hiß╗çn lu├┤n tr├¬n thiß║┐t bß╗ï
kh├┤ng c├│ hover: kh├ích ─æ├ú ─æ─âng nhß║¡p th├¬m xong chß╗ë thß║Ñy toast v├á ß╗ƒ lß║íi trang chß╗º;
kh├ích v├úng lai ─æ╞░ß╗úc ─æ╞░a sang `/login` rß╗ôi quay lß║íi ─æ├║ng bß╗Ö lß╗ìc. Cß║ú thß║╗ mß╗ƒ trang chi tiß║┐t. Nh├ún
╞░u ─æ├úi viß║┐t gß╗ìn th├ánh `╞»u ─æ├úi h├┤m nay` / `╞»u ─æ├úi cuß╗æi tuß║ºn` qua `discountText` d├╣ng chung.

`/foods/:id` l├á **trang ─æß╗Öc lß║¡p** trong `DefaultLayout`, kh├┤ng c├▓n l├á route con hay Drawer.
Trang c├│ hai cß╗Öt tß╗½ `lg`: cß╗Öt ß║únh `16/10` sticky (`lg:top-[calc(var(--header-h)+1rem)]`) v├á cß╗Öt
th├┤ng tin m├│n, ─æ├ính gi├í; gi├í, sß╗æ l╞░ß╗úng v├á n├║t th├¬m nß║▒m trong cß╗Öt th├┤ng tin. Trang kh├┤ng c├│ thanh
mua h├áng cß╗æ ─æß╗ïnh ─æ├íy.
Gi├í tr├¬n trang chi tiß║┐t d├╣ng ─æ├║ng mß╗Öt nguß╗ôn vß╗¢i thß║╗ m├│n. N├║t quay lß║íi ╞░u ti├¬n `state.from` do
thß║╗ m├│n truyß╗ün v├áo (k├¿m query bß╗Ö lß╗ìc); vß╗ï tr├¡ cuß╗Ön cß╗ºa l╞░ß╗¢i ─æ╞░ß╗úc l╞░u trong `sessionStorage`
(`menu-scroll`) v├á kh├┤i phß╗Ñc khi quay lß║íi. Th├¬m m├│n tß╗½ trang chi tiß║┐t mß╗ƒ drawer giß╗Å ─æß╗â kh├ích
thß║Ñy ngay m├│n vß╗½a th├¬m. URL c┼⌐ `/foods` chuyß╗ân h╞░ß╗¢ng vß╗ü `/`.

### Trang ─æß║╖t m├│n

`/checkout` l├á URL ch├¡nh v├á l├á trang duy nhß║Ñt ─æß╗â chß╗æt ─æ╞ín; `/cart` chß╗ë chuyß╗ân h╞░ß╗¢ng vß╗ü ─æ├óy.
Trang kh├┤ng lß║╖p lß║íi danh s├ích m├│n sß╗¡a ─æ╞░ß╗úc (viß╗çc ─æ├│ nß║▒m trong drawer giß╗Å), chß╗ë c├▓n:

- Thß║╗ ─æß╗ïa chß╗ë ─æ├ú l╞░u (chß╗ìn nhanh, th├¬m/sß╗¡a qua modal) v├á ba tr╞░ß╗¥ng ng╞░ß╗¥i nhß║¡n, sß╗æ ─æiß╗çn thoß║íi,
  ─æß╗ïa chß╗ë.
- Ph╞░╞íng thß╗⌐c thanh to├ín dß║íng thß║╗ chß╗ìn (`COD` / `QR`), ghi ch├║ cho qu├ín k├¿m chip gß╗úi ├╜.
- Cß╗Öt t├│m tß║»t sticky: sß╗æ m├│n, sß╗æ phß║ºn, tß║ím t├¡nh, giß║úm gi├í, tß╗òng thanh to├ín v├á n├║t x├íc nhß║¡n;
  d╞░ß╗¢i `lg` thanh ─æ├íy chß╗ë giß╗» tß╗òng tiß╗ün v├á mß╗Öt n├║t ─æß║╖t m├│n. N├║t "Sß╗¡a giß╗Å" mß╗ƒ drawer tß║íi chß╗ù.
- Mß╗ìi con sß╗æ vß║½n lß║Ñy tß╗½ `useCartQuote`, n├║t x├íc nhß║¡n kho├í khi quote ─æang tß║úi hoß║╖c lß╗ùi.

### Thanh ─æiß╗üu h╞░ß╗¢ng v├á hß╗ç n├║t

- Thanh ─æiß╗üu h╞░ß╗¢ng **mß╗Öt h├áng ß╗ƒ mß╗ìi k├¡ch th╞░ß╗¢c**: logo (`BrandMark`, bß║Ñm vß╗ü `/`), ├┤ t├¼m kiß║┐m
  co gi├ún (`flex-1`), n├║t ─æ╞ín h├áng, n├║t giß╗Å, avatar hoß║╖c n├║t ─æ─âng nhß║¡p. Chiß╗üu cao cß╗æ ─æß╗ïnh
  `--header-h = 3.25rem`; chatbot, v├╣ng cuß╗Ön kiosk v├á thanh ─æ├íy ─æß╗üu ─æß╗ìc biß║┐n n├áy, kh├┤ng
  hard-code lß║íi. Tß╗½ `lg` chu├┤ng v├á ─æ╞ín h├áng c├│ n├║t ri├¬ng tr├¬n header (chu├┤ng mang chß║Ñm ─æß╗Å ch╞░a
  ─æß╗ìc), d╞░ß╗¢i `lg` hai mß╗Ñc n├áy nß║▒m trong menu t├ái khoß║ún; n├║t ─æ╞ín h├áng chß╗ë hiß╗çn khi ─æ├ú ─æ─âng
  nhß║¡p v├¼ `/orders` bß║»t buß╗Öc token. Kh├┤ng c├│ menu ─æiß╗üu h╞░ß╗¢ng ri├¬ng; c├íc ─æ├¡ch c├▓n lß║íi nß║▒m trong
  menu t├ái khoß║ún v├á n├║t tß║»t sang khu quß║ún trß╗ï nß║┐u l├á admin.
- **Giß╗Å h├áng l├á drawer**, kh├┤ng phß║úi trang: `CartDrawer` rß╗Öng `min(480px, 100vw)`, danh s├ích
  m├│n sß╗¡a sß╗æ l╞░ß╗úng/xo├í tß║íi chß╗ù, footer sticky hiß╗çn tß║ím t├¡nh, giß║úm gi├í, tß╗òng v├á n├║t sang
  `/checkout`. Xo├í m├│n c├│ ho├án t├íc 5 gi├óy; khi c├│ m├│n ─æß╗ô uß╗æng/tr├íng miß╗çng ch╞░a trong giß╗Å th├¼
  hiß╗çn shelf "Th├¬m cho bß╗»a n├áy" vß╗¢i n├║t mß╗Öt chß║ím. Drawer chß╗ë mount nß╗Öi dung khi mß╗ƒ n├¬n kh├┤ng gß╗ìi
  b├ío gi├í ß╗ƒ mß╗ìi trang. `useCartQuote` debounce 250ms v├á cho ph├⌐p thß╗¡ lß║íi khi lß╗ùi.
- Trang `/login` v├á `/register` (`AuthShell`) kh├┤ng c├▓n hiß╗ân thß╗ï th╞░╞íng hiß╗çu/link vß╗ü bß║úng m├│n;
  trang quß║ún trß╗ï c├│ logo ri├¬ng trong `AdminLayout`.
- N├║t d├╣ng trß╗▒c tiß║┐p `NButton` cß╗ºa Naive UI, kh├┤ng c├▓n wrapper `UiButton`: mß╗ùi m├án h├¼nh giß╗»
  ─æ├║ng mß╗Öt n├║t `type="primary"` ch├¡nh; chiß╗üu cao mß║╖c ─æß╗ïnh cß╗ºa th╞░ viß╗çn, kh├┤ng ghi ─æ├¿ bß║▒ng
  class `!h-*` ─æi ng╞░ß╗úc lß║íi n├│.
- Thß║╗ m├│n ß╗ƒ l╞░ß╗¢i d├╣ng n├║t tr├▓n chß╗ë c├│ icon dß║Ñu cß╗Öng (c├│ tooltip t├¬n h├ánh ─æß╗Öng); m├│n hß║┐t
  hiß╗çn nh├ún "Hß║┐t m├│n" v├á n├║t bß╗ï v├┤ hiß╗çu ho├í. Trang chi tiß║┐t mß╗¢i d├╣ng n├║t "Th├¬m v├áo giß╗Å" **c├│ nh├ún**
  v├¼ Bß║úng 2.22 ghi r├╡ t├¬n th├ánh phß║ºn n├áy.
- M├áu ch├¡nh l├á `#b45309`, ─æß║╖t qua `NConfigProvider` `theme-overrides` (App.vue), chß╗» trß║»ng tr├¬n nß╗ün n├áy ─æß║ít t╞░╞íng phß║ún AA; sß║»c s├íng
  h╞ín chß╗ë d├╣ng cho logo v├á ─æiß╗âm nhß║Ñn lß╗¢n. `index.css` t├┤n trß╗ìng `prefers-reduced-motion` v├á giß╗»
  biß║┐n `--header-h` l├ám nguß╗ôn duy nhß║Ñt cho chiß╗üu cao header.

### Chatbot nß╗òi

Cß╗Ñm widget b├ím trang: `fixed inset-x-0 bottom-0 top-[var(--header-h)]` c├╣ng `justify-end`, khung
chat `flex-1` n├¬n tß╗▒ co theo chiß╗üu cao m├án h├¼nh thay v├¼ hard-code. V├╣ng trß╗æng cß╗ºa cß╗Ñm mang
`pointer-events-none` n├¬n kh├┤ng chß║╖n thao t├íc l├¬n thß║╗ m├│n ph├¡a sau. Trß║íng th├íi mß╗ƒ/─æ├│ng nß║▒m
trong `shared/stores/uiStore.ts`, nhß╗¥ vß║¡y hero v├á empty state mß╗ƒ chat ─æ╞░ß╗úc m├á kh├┤ng cß║ºn ─æi qua n├║t nß╗òi.
Launcher l├á n├║t tr├▓n 64px (56px tr├¬n mobile); `useHasBottomBar()` chß╗ë trß║ú `checkout | null`
─æß╗â launcher nh╞░ß╗¥ng chß╗ù cho thanh ─æß║╖t m├│n ß╗ƒ trang checkout.

Bß╗æ cß╗Ñc khung chat:

- Tin bot v├á tin kh├ích ─æß╗üu nß║▒m trong bong b├│ng: bot l├á bong b├│ng trß║»ng c─ân tr├íi (`rounded-bl-md`,
  viß╗ün mß║únh), kh├ích l├á bong b├│ng hß╗ò ph├ích c─ân phß║úi (`rounded-br-md`). ├ö chß╗» cß╗ºa bot rß╗Öng tß╗æi ─æa
  92%, cß╗ºa kh├ích 85%.
- Kh├┤ng c├▓n dß║úi chip gß╗úi ├╜ v─⌐nh viß╗àn; lß╗¥i ch├áo gß╗ôm **hai bong trß║»ng** (ch├áo ngß║»n + h╞░ß╗¢ng dß║½n bß║»t ─æß║ºu vß╗¢i v├¡ dß╗Ñ `Cho 2 ng╞░ß╗¥i 200k, kh├┤ng cay`). Ngay d╞░ß╗¢i lß╗¥i ch├áo l├á **mß╗Öt h├áng n├║t ─æiß╗âm v├áo** (`Gß╗úi ├╜ m├│n cho 2 ng╞░ß╗¥i`, `M├│n chay kh├┤ng cay`, `Giß╗¥ mß╗ƒ cß╗¡a l├á mß║Ñy giß╗¥?`, `C├ích ─æß║╖t m├│n thß║┐ n├áo?`), bß║Ñm l├á gß╗¡i tin nh╞░ kh├ích tß╗▒ g├╡; chß╗ë hiß╗çn khi hß╗Öi thoß║íi c├▓n mß╗¢i v├á biß║┐n mß║Ñt sau tin ─æß║ºu ti├¬n. Placeholder l├á `Nhß║¡p y├¬u cß║ºu m├│n ─ân...`.
- N├║t **L├ám mß╗¢i hß╗Öi thoß║íi** tr├¬n thanh ti├¬u ─æß╗ü xo├í ngß╗» cß║únh c┼⌐ (tin nhß║»n, `lastFoodIds`,
  `sessionId` mß╗¢i) ─æß╗â c├óu hß╗Åi tiß║┐p kh├┤ng d├¡nh v├áo m├│n cß╗ºa l╞░ß╗út tr╞░ß╗¢c. Tin bot chß║íy chß╗» dß║ºn theo tß╗½;
  ai bß║¡t `prefers-reduced-motion` th├¼ thß║Ñy ngay to├án bß╗Ö c├óu trß║ú lß╗¥i. Chatbot kh├┤ng c├│ trang to├án m├án
  h├¼nh ri├¬ng; mß╗ƒ khung bß║▒ng n├║t nß╗òi, hero hoß║╖c empty state cß╗ºa trang thß╗▒c ─æ╞ín.
- Thß║╗ m├│n gß╗Öp trong **mß╗Öt khung trß║»ng**, c├íc d├▓ng ng─ân bß║▒ng ─æ╞░ß╗¥ng kß║╗, kh├┤ng viß╗ün ri├¬ng tß╗½ng
  thß║╗: ß║únh 40px, t├¬n mß╗Öt d├▓ng, gi├í hß╗ò ph├ích c─ân phß║úi. Cß║ú d├▓ng l├á li├¬n kß║┐t tß╗¢i `/foods/:id`.
  Khung n├áy canh c├╣ng m├⌐p tr├íi vß╗¢i bong b├│ng cß╗ºa bot.
- **Chß╗ë tin bot mß╗¢i nhß║Ñt giß╗» thß║╗ m├│n**, tß╗æi ─æa 5 thß║╗. Khi nhß║¡n tin bot mß╗¢i, client bß╗Å thuß╗Öc
  t├¡nh `foods` cß╗ºa mß╗ìi tin bot c┼⌐ (vß║½n giß╗» nß╗Öi dung chß╗») rß╗ôi gß║»n thß║╗ cß╗ºa tin mß╗¢i. Nhß╗¥ vß║¡y khung
  chat kh├┤ng dß╗ôn thß║╗ v├á kh├ích kh├┤ng t╞░ß╗ƒng m├│n cß╗ºa l╞░ß╗út c┼⌐ l├á gß╗úi ├╜ hiß╗çn tß║íi.
- N├║t th├¬m v├áo giß╗Å trong thß║╗ y├¬u cß║ºu ─æ─âng nhß║¡p: kh├ích v├úng lai thß║Ñy n├║t disabled k├¿m tooltip
  "─É─âng nhß║¡p ─æß╗â th├¬m m├│n v├áo giß╗Å" v├á bß║Ñm v├áo kh├┤ng ─æiß╗üu h╞░ß╗¢ng theo link cß╗ºa thß║╗.
- Khi server thiß║┐u kh├│a AI, `GET /api/chatbot/status` trß║ú `available = false`; khung chat hiß╗çn
  banner hß╗ò ph├ích ngay d╞░ß╗¢i thanh ti├¬u ─æß╗ü, kh├│a ├┤ nhß║¡p v├á n├║t gß╗¡i. `ChatResponse`
  gß╗ôm `reply`, `foods`, `intent`, `citations` (citations chß╗ë c├│ khi tra t├ái liß╗çu qu├ín) v├á
  `quickReplies` (tß╗æi ─æa 3 n├║t h├ánh ─æß╗Öng tiß║┐p theo do server quyß║┐t ─æß╗ïnh).
  Nß║┐u vß║½n nhß║¡n 503 l├║c gß╗¡i (trß║íng th├íi ─æß╗òi sau khi mß╗ƒ khung), client b├ío ─æ├║ng c├óu ─æ├│ v├á kh├│a
  khung chat thay v├¼ mß╗¥i thß╗¡ lß║íi.
- N├║t gß╗¡i nß║▒m trong ├┤ nhß║¡p (`suffix`) thay v├¼ mß╗Öt n├║t tr├▓n ri├¬ng, n├¬n khung chat ─æß╗í mß╗Öt phß║ºn
  tß╗¡ v├á ├┤ nhß║¡p kh├┤ng bß╗ï b├│ hß║╣p.
- Ba chß║Ñm "─æang trß║ú lß╗¥i" c┼⌐ng nß║▒m trong bong b├│ng trß║»ng c├╣ng kiß╗âu ─æß╗â khung nh├¼n nhß║Ñt qu├ín.

Ph├¡a server, `extractCriteria` trß║ú `null` khi AI lß╗ùi hoß║╖c JSON sai. `chat()` kh├┤ng coi ti├¬u
ch├¡ rß╗ùng l├á khß╗¢p mß╗ìi m├│n (l├ám vß║¡y kh├ích hß╗Åi m├│n chay sß║╜ nhß║¡n c├á ph├¬ ─æ├í), m├á chuyß╗ân sang nh├ính
dß╗▒ ph├▓ng chß║Ñm ─æiß╗âm bß║▒ng code. Khi tr├¡ch xuß║Ñt th├ánh c├┤ng nh╞░ng sinh c├óu trß║ú lß╗¥i thß║Ñt bß║íi th├¼
thß║╗ m├│n cß╗ºa b╞░ß╗¢c lß╗ìc vß║½n hiß╗çn, v├¼ ch├║ng khß╗¢p thß║¡t c├óu hß╗Åi.

T├ái liß╗çu tri thß╗⌐c mß║½u kh├┤ng ─æ╞░ß╗úc hß╗⌐a ─æiß╗üu m├á hß╗ç thß╗æng kh├┤ng l├ám: `order` module (createOrder) chß╗ë cß╗Öng
tiß╗ün m├│n n├¬n t├ái liß╗çu ─æ├ú bß╗Å c├óu "Ph├¡ giao h├áng 15.000 ─æß╗ông". Ba c├óu c├▓n lß║íi (giß╗¥ mß╗ƒ cß╗¡a, khu vß╗▒c
kh├┤ng phß╗Ñc vß╗Ñ, thß╗¥i gian giao) l├á th├┤ng tin, kh├┤ng sinh ra con sß╗æ sai vß╗ü tiß╗ün, nh╞░ng c┼⌐ng
kh├┤ng c├│ code kiß╗âm chß╗⌐ng.

## Cß║Ñu tr├║c m├ú nguß╗ôn

```
server/
  drizzle/               # SQL migrations theo thß╗¥i gian do drizzle-kit quß║ún l├╜ (gß╗ôm cß║ú search_vector tsvector + GIN)
  drizzle.config.ts      # Drizzle config: schema path, out dir, datasource url
  src/
    config/env.ts        # zod ─æß╗ìc biß║┐n m├┤i tr╞░ß╗¥ng, fail-fast khi thiß║┐u JWT_SECRET/DATABASE_URL
    db/
      schema.ts          # to├án bß╗Ö 15 bß║úng + 7 enums ─æß╗ïnh ngh─⌐a bß║▒ng TypeScript
      relations.ts       # quan hß╗ç giß╗»a c├íc bß║úng phß╗Ñc vß╗Ñ Drizzle Relational Queries (`db.query.*`)
      seed.ts            # dß╗» liß╗çu demo; chß╗ë chß║íy khi bß║úng users trß╗æng
    lib/                 # db (drizzle client + connection pool), jwt, password, errors, validate, text-normalizer, businessTime, serializers, gemini
    middleware/          # auth (requireAuth/optionalAuth/requireRole), error (errorHandler), rateLimit
    user/                             # module phß╗Ñc vß╗Ñ kh├ích
      auth/      routes.ts  service.ts  schema.ts
      menu/      routes.ts  service.ts   # GET /api/foods, /api/categories (public)
      review/    routes.ts  service.ts  schema.ts
      profile/   routes.ts  service.ts  schema.ts   # ─æß╗ïa chß╗ë ─æ├ú l╞░u
      cart/      routes.ts  service.ts  schema.ts
      order/     routes.ts  service.ts  schema.ts  transitions.ts
      payment/   routes.ts  service.ts
      pricing/   service.ts  engine.ts               # n╞íi duy nhß║Ñt t├¡nh tiß╗ün v├á khuyß║┐n m├úi
      notification/ routes.ts  service.ts
      chatbot/   routes.ts  service.ts  select.ts  criteria.ts  filters.ts  prompts.ts  retrieval.ts  ingest.ts  documentParser.ts
    admin/                            # module phß╗Ñc vß╗Ñ quß║ún trß╗ï
      menu/      routes.ts  service.ts  schema.ts
      order/     routes.ts  service.ts  schema.ts
      customer/  routes.ts  service.ts  schema.ts
      promotion/ routes.ts  service.ts  schema.ts
      chatbot/   routes.ts  service.ts  schema.ts
      payment/   routes.ts  service.ts
      report/    routes.ts  service.ts
      upload/    routes.ts  service.ts
      routes.ts                          # aggregator, apply requireRole 1 lß║ºn
    app.ts  server.ts
  tests/                 # Vitest, chß║íy kh├┤ng cß║ºn DB

client/src/
  main.ts  App.vue(router)  index.css  shared/(api/http, api/message, types, utils, stores)  composables/
  user/  (auth, cart, menu, order, payment, profile, review, notification, chatbot ΓÇö mß╗ùi module api.ts/store.ts/components/pages)
  admin/ (menu, order, payment, customer, promotion, chatbot, report, dashboard ΓÇö api.ts/pages + shell UI d├╣ng chung)
  router/index.ts  layouts/DefaultLayout.vue  layouts/AdminLayout.vue  components/
```

Sß╗¡a DTO/response phß║úi cß║¡p nhß║¡t ─æß╗ông thß╗¥i server module t╞░╞íng ß╗⌐ng v├á
`client/src/shared/types/index.ts` + file `api.ts` cß╗ºa module client t╞░╞íng ß╗⌐ng.

## M├┤i tr╞░ß╗¥ng & chß║íy

B├¡ mß║¡t nß║▒m trong mß╗Öt file `.env` ß╗ƒ root (copy tß╗½ `.env.example`): `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `AI_API_KEY`, `AI_MODEL`. Compose tß╗▒ dß╗▒ng
`DATABASE_URL`; `AI_PROVIDER` mß║╖c ─æß╗ïnh `gemini`, `UPLOAD_DIR=/app/uploads` trong container.
Khi chß║íy server ngo├ái Docker m├á kh├┤ng c├│ `DATABASE_URL`, server tß╗▒ gh├⌐p tß╗½ `DB_*` (host `localhost`).

- Dev: `docker compose --profile dev up --build` (client http://localhost:5173, server :8080). Server dev chß║íy `tsx watch` tß╗▒ reload khi file ─æß╗òi.
- Prod: `docker compose --profile prod up --build -d` (client http://localhost)
- Tools: `docker compose --profile tools up -d drizzle-studio` (Drizzle Studio ß╗ƒ http://localhost:4983)
- `docker compose up` (kh├┤ng profile): chß╗ë Postgres. Service `database` kh├┤ng khai b├ío `profiles`
  n├¬n n├│ lu├┤n chß║íy theo mß╗ìi profile, kß╗â cß║ú `tools`.
- Migration CSDL: `cd server && npm run db:generate` (sinh migration) / `npm run db:migrate` (├íp dß╗Ñng migration), seed bß║▒ng `npm run db:seed`. Cß╗Öt `search_vector tsvector` (RAG) ─æ╞░ß╗úc tß║ío trß╗▒c tiß║┐p trong migration SQL.
- Client dev d├╣ng Vite HMR, kh├┤ng cß║ºn build lß║íi image trß╗½ khi ─æß╗òi `package.json`.

## Kiß╗âm thß╗¡

- Server c├│ c├íc unit test Vitest (`server/tests/`), chß║íy ─æß╗Öc lß║¡p kh├┤ng cß║ºn DB (`npm test`).
- Client kiß╗âm tra bß║▒ng `npm run typecheck` v├á `npm run build`; E2E d├╣ng Playwright ß╗ƒ `client/e2e/`
  (`npm run test:e2e`), cß║ºn stack dev ─æang chß║íy v├á kh├┤ng ─æ╞░ß╗úc CI chß║íy.
- CI (`.github/workflows/ci.yml`) chß║íy `typecheck` + `build` cho client v├á
  `typecheck` + `test` + `build` cho server.

## Quy tß║»c quan trß╗ìng khi l├ám viß╗çc

- Schema quß║ún l├╜ bß║▒ng Drizzle ORM (`drizzle-kit`). Mß╗ìi thay ─æß╗òi schema ─æi qua `schema.ts`, sinh migration SQL v├á commit k├¿m.
- DB mß╗¢i ho├án to├án: seed chß╗ë chß║íy khi bß║úng `users` trß╗æng; ─æß╗òi dß╗» liß╗çu mß║½u th├¼ DB c┼⌐ giß╗» nguy├¬n ΓÇö reset bß║▒ng
  `docker compose --profile prod down -v`.
- Mß╗ìi quy tß║»c giß║úm gi├í sß╗¡a ß╗ƒ lß╗¢p pricing (`user/pricing`), ─æß╗½ng t├¡nh lß║íi ß╗ƒ Vue.
- Sß╗¡a endpoint/DTO/quy tß║»c domain ΓåÆ cß║¡p nhß║¡t ─æß╗ông bß╗Ö `AGENTS.md`, `ARCHITECTURE.md`, `TEST.md`.
- Kh├┤ng giß╗» b├¡ mß║¡t trong code; chß╗ë trong `.env`.
