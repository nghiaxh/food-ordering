Chatbot tư vấn món ăn, trả lời bằng tiếng Việt và chỉ gợi ý món có thật trong thực đơn.

## Ai dùng được

- Phải đăng nhập. `POST /api/chatbot/chat` dùng `requireAuth` (`server/src/user/chatbot/routes.ts`).
- Client chỉ mở hội thoại cho tài khoản `CUSTOMER`; khách chưa đăng nhập thấy nút "Đăng nhập" trong `client/src/user/chatbot/components/ChatbotWidget.vue`.
- Lịch sử lưu theo tài khoản trong bảng `chat_messages`.

## Một lượt chat đi qua bốn bước

```
Người dùng
  -> (1) Server đọc tiêu chí bằng regex        parse.ts, constraints.ts
  -> (2) Server lọc món bằng SQL Drizzle       select.ts (filterMenu)
  -> (3) AI viết câu trả lời từ danh sách món thật   reply.ts (composeFoodReply)
  -> (4) Thẻ món lấy ID/giá từ CSDL             select.ts (buildCards)
```

AI **không bao giờ** tự nghĩ ra món hoặc giá. Prompt chỉ nhận tên, giá và loại của tối đa 10 món do server lọc.

## Các file chính

```
server/src/user/chatbot/
  routes.ts          endpoint chat, status, sessions
  parse.ts           nhận diện ý định và câu hỏi tiếp
  constraints.ts     đọc ngân sách, số người, độ cay, chế độ ăn, dị ứng
  select.ts          filterMenu (SQL), buildCards, quickRepliesFor
  reply.ts           composeFoodReply (AI), composeInfoReply (RAG)
  prompts.ts         mẫu prompt
  service.ts         điều phối một lượt chat
  grounding.ts       chặn ngôn ngữ lạ, bỏ câu hỏi cuối, giới hạn số câu
  sessions.ts        tiêu đề và lịch sử hội thoại
  retrieval.ts       tìm chunk bằng pgvector
  ingest.ts          upload, chunk, embed tài liệu
  documentParser.ts  đọc PDF/DOCX/TXT/MD và chia chunk
```

## Bước 1: nhận diện ý định

`parse.ts` gọi `normalizeChat` để đổi teencode phủ định trước khi đọc regex:

- "ko", "k", "hok", "hem" thành "không".
- "100 k" thành "100k".

Sau đó phân loại:

| Ý định | Xử lý |
|---|---|
| `GREETING`, `THANKS`, `CONFIRM`, `ORDER_GUIDE` | Trả câu cố định, không gọi AI |
| `RESTAURANT_INFO` | Tìm tài liệu quán bằng RAG |
| `OUT_OF_SCOPE` | Từ chối lịch sự, không gọi AI, không trả thẻ |
| `FOOD` | Lọc món rồi gọi AI viết câu trả lời |

Câu bị coi là ngoài phạm vi khi không có tín hiệu món ăn (`hasFoodSignal`) và không có ràng buộc nào, hoặc gõ lung tung (`looksLikeGibberish`, cụm phụ âm từ 5 ký tự).

Câu hỏi tiếp:

- "món khác", "gợi ý thêm" (`wantsMoreDishes`) loại các món vừa gợi ý bằng `NOT IN`.
- "món đó", "mấy món trên" (`refersToLastPicks`) chỉ xét trong danh sách vừa gợi ý bằng `IN`.
- Đại từ bị `isReferenceKeyword` loại trước khi lọc theo tên.

## Bước 2: lọc món bằng SQL

`constraints.ts` đọc ràng buộc: ngân sách, số người, độ cay, chế độ ăn, tên món, thành phần cần tránh.

`select.ts` `filterMenu` dựng điều kiện Drizzle:

1. Chỉ món `available`.
2. `lastFoodIds` dùng để loại hoặc giới hạn tùy câu hỏi.
3. Lọc `spicyMax`, `spicyRequired`, nhãn chế độ ăn, thành phần loại trừ.
4. `spicyMax = 0` chặn thêm tên/nguyên liệu chứa "ớt", vì dữ liệu `spicyLevel` có thể sai.
5. Ngân sách là tổng của cả nhóm, nên mỗi món bị chặn ở `floor(budget / people)`.
6. Sắp giá tăng dần, ưu tiên món chính, lấy tối đa 10 dòng.

Số thẻ trả về tối đa 5, theo `ai_setting.max_suggestions` (kẹp 1..5). Server cắt ở `buildCards`, không giao cho AI tự tính.

## Bước 3: AI viết câu trả lời

- `reply.ts` `composeFoodReply` gọi `provider.generate` với `jsonMode`.
- Prompt ở `prompts.ts` chỉ nhận danh sách món đã lọc, tối đa 10 món.
- AI trả về câu trả lời và danh sách ID món được chọn.
- Nếu AI lỗi 5xx, timeout hoặc JSON hỏng, `chat()` ném `502`. Nếu bị rate limit, ném `429`.

Câu trả lời được dọn ở server bằng `grounding.ts`:

- `hasForeignScript`: phát hiện ngôn ngữ lệch, dùng câu mẫu an toàn.
- `dropTrailingQuestion`: bỏ câu hỏi cuối.
- `limitSentences`: cắt còn 3 câu.

## Bước 4: thẻ món

`buildCards` lấy ID, tên và ảnh từ CSDL. Thẻ trả về client không dùng ID từ text AI, nên không có chuyện AI bịa món hoặc bịa giá.

Giá trong thẻ là giá lúc trả lời. Khi thêm vào giỏ hoặc đặt đơn, server vẫn tính lại theo giá hiện tại trong CSDL.

Chỉ tin bot mới nhất giữ thẻ món; tin cũ chỉ còn chữ.

## Lịch sử hội thoại

- `loadContext` đọc 3 câu hỏi gần nhất của chính tài khoản và danh sách món ở tin bot gần nhất.
- `GET /api/chatbot/sessions` trả tối đa 20 phiên mới nhất.
- `GET /api/chatbot/sessions/latest` trả phiên mới nhất; client gọi khi mở khung chat.
- `GET /api/chatbot/sessions/:id`, `DELETE /api/chatbot/sessions/:id`.
- Tiêu đề phiên lấy từ câu hỏi đầu tiên, cắt 60 ký tự (`sessions.ts` `sessionTitle`).
- Phiên của người khác trả 404 như phiên không tồn tại.
- Tin bot lưu kèm `payload` jsonb gồm `foods`, `intent`, `citations`, `quickReplies`, nên mở lại vẫn còn thẻ.

## RAG tài liệu quán

Dùng cho câu hỏi về giờ mở cửa, giao hàng, địa chỉ, chính sách.

- Upload, đọc và chia chunk không gọi AI, luôn chạy.
- Chunk giữ tiêu đề, overlap 80 ký tự, không cắt giữa từ.
- Chỉ embed khi provider dùng được. Thiếu khoá thì chunk vẫn lưu nhưng không có vector.
- `retrieval.ts` `searchChunks` nhúng câu hỏi, tìm cosine top 5, ngưỡng 0.55, chỉ tài liệu `enabled`.
- Câu trả lời ghép bullet trích chunk (cắt 400 ký tự) kèm `citations`, không gọi AI lượt hai.
- Không tìm thấy thì trả: "Mình chưa có thông tin xác thực về mục này trong tài liệu của quán."

Không còn tìm kiếm `tsvector` hay fallback keyword.

## Khi thiếu hoặc hỏng khoá AI

`server/src/lib/provider.ts`:

- `isConfigured()` false khi `AI_API_KEYS` rỗng hoặc mọi khoá bị từ chối (401/403, hoặc 400 kèm `API_KEY_INVALID`).
- Khoá bị từ chối bị loại tới khi khởi động lại server.
- Khoá bị 429 nghỉ 25 giây rồi xoay khoá khác.
- Model lỗi 503/404/timeout thì xoay model kế tiếp; model 404 bị loại, model 503/timeout nghỉ 60 giây.
- Timeout theo bước: trả lời 20 giây, embedding 8 giây; deadline tổng 45 giây.

Khi không dùng được:

- `chat()` ném `503` trước khi lưu câu hỏi hay chọn món.
- `GET /api/chatbot/status` trả `available = false`, client khoá ô nhập và hiện banner.
- RAG trả câu "chưa có thông tin xác thực".
- Embedding không chạy.
- Các nhánh không gọi AI (chào, cảm ơn, hướng dẫn đặt món, ngoài phạm vi) vẫn chạy.

`GET /api/chatbot/status` kiểm tra khoá và probe song song các model. Chỉ trả `available = false` khi mọi model đều lỗi rõ ràng; model chậm vẫn tính là dùng được. Kết quả false giữ 60 giây, true giữ 5 phút.

## Cấu hình từ trang quản trị

Trang `/admin/chatbot` chỉ lưu hai giá trị:

- `max_suggestions`: số thẻ tối đa, kẹp 1..5.
- `extra_rules`: quy tắc thêm cho prompt.

Model chat và model embedding đọc từ `AI_MODELS` và `EMBEDDING_MODELS`, không hardcode trong trang quản trị.
