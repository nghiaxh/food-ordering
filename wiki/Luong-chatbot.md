# Luồng chatbot

Trang này giải thích vì sao trợ lý AI không bịa món hoặc giá, và cách tài liệu tri thức của quán được dùng.

## Trải nghiệm trên màn hình

- Widget chat mở bằng `uiStore.chatOpen`, không phải state cục bộ, nên hero và empty state cũng mở được.
- Chỉ khách `CUSTOMER` dùng được lịch sử; admin và khách vãng lai thấy nút \"Đăng nhập\".
- Khi chờ phản hồi, client vòng qua các trạng thái \"Đang phân tích...\" → \"Đang tra cứu...\" → \"Đang soạn câu trả lời...\" khoảng 600 ms mỗi bước; phản hồi tối thiểu 2 giây.
- Chỉ tin bot mới nhất giữ thẻ món (tối đa 5); tin cũ mất thẻ.
- Khung tự cuộn khi đang ở đáy (cách đáy ≤ 64 px); cuộn lên thì hiện nút \"Tin mới nhất\".

## Bốn bước chống AI bịa

```mermaid
flowchart LR
  U[\"Người dùng\"] --> P[\"1. Đọc tiêu chí bằng regex\"]\n  P --> F[\"2. Lọc món bằng SQL\"]\n  F --> A[\"3. AI viết câu dựa trên danh sách thật\"]\n  A --> C[\"4. Thẻ món lấy ID từ DB\"]\n```

1. `parseMessage` (`server/src/user/chatbot/parse.ts:82`) đọc ràng buộc từ câu.
2. `filterMenu` (`server/src/user/chatbot/select.ts:22`) dựng điều kiện Drizzle và truy vấn SQL.
3. `composeFoodReply` (`server/src/user/chatbot/reply.ts:51`) gọi AI với `jsonMode`, chỉ gửi tên, giá, loại của tối đa 10 món.
4. `buildCards` (`server/src/user/chatbot/select.ts:93`) cắt thẻ theo `max_suggestions` và lấy ID/giá từ DB.

AI không bao giờ tự nghĩ ra món hoặc giá. Prompt chỉ nhận danh sách món server đã lọc.

## Cổng ý định

`normalizeChat` đổi teencode phủ định (\"ko/k/hok/hem\" → \"không\", \"100 k\" → \"100k\") trước khi đọc regex. Câu không có tín hiệu món ăn (`hasFoodSignal`) và không có ràng buộc nào, hoặc gõ lung tung (`looksLikeGibberish`, cụm phụ âm ≥ 5) trả câu từ chối cố định, `intent = OUT_OF_SCOPE`, không gọi AI và không trả thẻ món.

`parseMessage` (`parse.ts:82`) trả về `ParsedQuery` gồm `intent`, `criteria`, `more`, `onlyLast`, `gibberish`.

## Cách áp tiêu chí

Regex đọc: `budget`, `people`, `spicyMax`, `spicyRequired`, `diets`, `exclude`, `groups`, `dishIds`. Criteria rỗng khớp mọi món, nên phải có cổng ý định ở trên để không trả cà phê đá cho câu \"món chay\".

Lọc SQL trong `filterMenu` (`select.ts:22-91`):

1. Chỉ món `available`.
2. `lastFoodIds`: loại (\"món khác\" → `NOT IN`) hoặc giới hạn (\"món đó\" → `IN`).
3. Lọc `spicyMax`, `spicyRequired`, nhãn chế độ ăn, thành phần loại trừ. `spicyMax = 0` chặn thêm tên/nguyên liệu chứa \"ớt\" vì dữ liệu `spicyLevel` có thể sai (`select.ts:36-39`).
4. Ngân sách là **tổng** của cả nhóm, nên mỗi món bị chặn ở `floor(budget / people)` (`select.ts:16-20`).
5. Kết quả tối đa 40 dòng, sắp theo giá tăng dần và ưu tiên món chính (`select.ts:60`, `:64-78`).

Thẻ trả về tối đa 5 (`buildCards`, `select.ts:93-100`), theo `ai_setting.max_suggestions` kẹp 1..5 (`service.ts:31-39`).

## Khi AI lỗi

- `chat()` ném 503 trước khi lưu câu hỏi hay chọn món nếu `!isConfigured()` (`service.ts:76`).
- AI lỗi 5xx/timeout/JSON hỏng thì `composeFoodReply` ném 502 (`reply.ts:79-92`).
- Bị rate limit thì ném 429 (`reply.ts:79`).
- Câu trả lời dùng template an toàn khi AI trả ngôn ngữ lệch (`hasForeignScript`, `grounding.ts:4-6`).
- `dropTrailingQuestion` bỏ câu hỏi cuối, `limitSentences` cắt còn 3 câu (`grounding.ts:8-19`).

## RAG tài liệu quán

Chỉ khi provider dùng được:

- Upload, parse, chunk **không gọi AI**, luôn chạy. Chunk v2: tách theo đoạn, giữ tiêu đề, overlap 80 ký tự, không cắt giữa từ (`documentParser.ts:27-99`).
- Embed chunk chỉ khi `isConfigured()` = true; thiếu khoá hoặc provider lỗi thì chunk vẫn lưu, thiếu vector.
- Retrieval: `searchChunks` nhúng câu hỏi, cosine top 5, ngưỡng 0.55, chỉ tài liệu `enabled` (`retrieval.ts:14-66`). Thiếu vector → rỗng.
- Trả lời: `composeInfoReply` ghép bullet trích chunk (cắt 400 ký tự) kèm `citations`, không gọi AI lượt 2 (`reply.ts:99-106`). Rỗng → \"Mình chưa có thông tin xác thực...\".
- Bỏ hoàn toàn tsvector và `keywordSearchKnowledge`. Không còn fallback keyword.

Model embedding: 768 chiều, chọn theo `EMBEDDING_MODELS`. Cột `vector(768)` và HNSW index `vector_cosine_ops` (`server/src/db/schema.ts:245-257`).

## Câu hỏi tiếp

`history` (3 câu gần nhất) và `lastFoodIds` (món ở tin bot gần nhất) đọc ở server (`loadContext`, `service.ts:41-55`), không cần client gửi kèm.

- `wantsMoreDishes` (\"món khác\", \"gợi ý thêm\") loại đúng các món đó bằng `NOT IN`.
- `refersToLastPicks` (\"món đó\", \"mấy món trên\") chỉ xét trong `lastFoodIds` bằng `IN`.
- Đại từ tham chiếu được loại trước khi lọc ILIKE, nếu không danh sách ra rỗng.
- Không dùng độ dài câu để đoán hỏi tiếp.

## Lịch sử hội thoại

Mỗi tài khoản có lịch sử riêng:

- `GET/DELETE /api/chatbot/sessions/**` yêu cầu đăng nhập.
- `listSessions`/`getLatestSession`/`getSession`/`deleteSession` trong `user/chatbot/service.ts`.
- Tin BOT lưu kèm `chat_messages.payload` (jsonb) gồm `foods`/`intent`/`citations`/`quickReplies`, nên mở lại phiên vẫn còn thẻ món.
- Giá trong thẻ là giá lúc trả lời; thêm vào giỏ/đặt đơn vẫn lấy giá hiện tại từ DB.
- Danh sách trả tối đa 20 phiên mới nhất, tiêu đề lấy từ câu hỏi USER đầu tiên (`sessions.ts` `sessionTitle`, cắt 60 ký tự).
- Phiên của người khác trả 404 như phiên không tồn tại.

Client (`useChatConversation.ts`) gọi `GET /api/chatbot/sessions/latest` khi mount (chỉ với CUSTOMER) để khôi phục phiên mới nhất từ server; không còn cache `localStorage`. `requestEpoch` tăng mỗi lần `resetChat`/`applyHistory` để phản hồi đang bay của phiên cũ bị bỏ.

## Thiếu hoặc hỏng khoá AI

`lib/provider.ts` `isConfigured()` false khi không có khoá nào còn sống (`provider.ts:141`).

- `GET /api/chatbot/status` gọi `verifyKey()` và probe song song các model; `available = false` chỉ khi **mọi** model đều báo lỗi rõ ràng (503/404), còn một model chậm (timeout) hay chết riêng lẻ vẫn tính là dùng được. Kết quả false giữ 60s, true giữ 5 phút (`provider.ts:15-16`).
- `chat()` ném 503 trước khi lưu câu hỏi hay chọn món (`service.ts:76`).
- status trả `available = false` để client khoá ô nhập, hiện banner.
- RAG trả \"Mình chưa có thông tin xác thực về mục này trong tài liệu của quán.\"
- Embedding không chạy, chunk vẫn lưu nhưng thiếu vector.
- Nhánh không gọi AI (chào, cảm ơn, hướng dẫn đặt món, câu ngoài phạm vi) vẫn chạy bình thường.

## Provider AI

`server/src/lib/provider.ts` là lớp duy nhất gọi API AI (`generate` với `jsonMode`) và sinh vector embedding (`embed`, `embedBatch`).

- Chỉ hỗ trợ Gemini (`@google/genai`).
- Khoá đọc từ `AI_API_KEYS`, model chat từ `AI_MODELS`, model embedding từ `EMBEDDING_MODELS`; cả ba nhận một giá trị hoặc danh sách phân tách dấu phẩy/xuống dòng.
- Tự xoay khoá khi một khoá bị 429 và loại khoá bị từ chối (401/403 hoặc `API_KEY_INVALID`) tới khi khởi động lại server.
- Danh sách model mặc định `gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash`; gặp 503/404/timeout thì xoay model kế tiếp, model 404 bị loại tới khi restart, model 503/timeout nghỉ 60s.
- Vector 768 chiều (`EMBEDDING_DIM`).
- Retry tối đa 2 lần cho 5xx (delay 600 ms rồi 1800 ms), khoá 25s sau một 429 thật và xoay khoá khác, deadline tổng 45s (`provider.ts:8-22`).
- Timeout riêng theo bước (`AI_TIMEOUTS.reply` 20s, `embed` 8s); `thinkingBudget: 0` gửi cho mọi model chat, model nào trả 400 thì bỏ cờ và ghi nhớ theo model.
- Prompt trả lời chỉ gửi tên/giá/loại của tối đa 10 món.

Tiếp theo: [Luồng quản trị](Luong-quan-tri) hoặc [API](API).
