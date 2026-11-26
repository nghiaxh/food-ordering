# Thuật ngữ

Bảng này giải thích các từ chuyên môn xuất hiện trong code và wiki. Mỗi mục chỉ một định nghĩa.

| Thuật ngữ | Định nghĩa | Nơi định nghĩa |
|---|---|---|
| `available` | Món còn phục vụ; `false` là ngừng bán | `server/src/db/schema.ts:89` |
| `buildCards` | Cắt danh sách món thành thẻ trả về client, tối đa `max_suggestions` | `server/src/user/chatbot/select.ts:93` |
| `chunk` | Đoạn văn khoảng 600 ký tự của tài liệu tri thức | `server/src/user/chatbot/documentParser.ts:27` |
| `criteria` | Ràng buộc đọc được từ câu chat (ngân sách, người, độ cay, chế độ ăn, loại trừ, tên món) | `server/src/user/chatbot/parse.ts:7-16` |
| `decorateFoods` | Điền giá sau khuyến mãi vào Food để client hiển thị | `server/src/user/pricing/service.ts:142` |
| `embed` / `embedBatch` | Sinh vector 768 chiều từ văn bản | `server/src/lib/provider.ts` |
| `extra_rules` | Quy tắc bổ sung admin viết cho AI trả lời | `server/src/user/chatbot/service.ts:31-39` |
| `filterMenu` | Lọc món bằng SQL Drizzle theo criteria | `server/src/user/chatbot/select.ts:22` |
| `hasFoodSignal` | Có tín hiệu món ăn trong câu | `server/src/user/chatbot/parse.ts` |
| `intent` | Ý định của câu chat: FOOD, RESTAURANT_INFO, ... | `server/src/user/chatbot/parse.ts:5` |
| `isConfigured` | Có ít nhất một khoá Gemini còn sống | `server/src/lib/provider.ts:141` |
| `lastFoodIds` | ID món ở tin bot gần nhất, dùng cho \"món khác\" / \"món đó\" | `server/src/user/chatbot/service.ts:41-55` |
| `max_suggestions` | Số thẻ món tối đa trả về, kẹp 1..5 | `server/src/user/chatbot/service.ts:31-39` |
| `minOrderReached` | Tổng đơn đạt hạn mức tối thiểu của khuyến mãi | `server/src/user/pricing/engine.ts:53` |
| `notify` | Tạo thông báo cho khách trong transaction | `server/src/user/order/service.ts:74-86` |
| `priceOrder` | Tính giá và khuyến mãi cho một đơn | `server/src/user/pricing/service.ts:61` |
| `quote` | Tính tiền theo danh sách dòng client gửi, không đọc giỏ DB | `server/src/user/cart/service.ts:92` |
| `RAG` | Retrieval-Augmented Generation: truy xuất tài liệu rồi ghép vào câu trả lời | `server/src/user/chatbot/retrieval.ts` |
| `safeReply` | Dọn câu trả lời AI, dùng template nếu ngôn ngữ lệch | `server/src/user/chatbot/reply.ts:29` |
| `sessionTitle` | Tiêu đề phiên lấy từ câu hỏi USER đầu tiên, cắt 60 ký tự | `server/src/user/chatbot/sessions.ts` |
| `transition` | Chuyển trạng thái đơn có luật một chiều | `server/src/user/order/service.ts:31` |
| `validPicked` | Kiểm ID AI chọn có nằm trong danh sách candidate không | `server/src/user/chatbot/reply.ts:13` |

Tiếp theo: [Home](Home).
