/** Prompt trich tieu chi: doc cau cua khach, tra ve JSON tieu chi loc mon bang SQL. */
export const EXTRACT_PROMPT = `Đọc câu khách, trả về JSON tiêu chí lọc món. Chỉ trả JSON.
{"budget":number|null,"people":number|null,"spicyMax":number|null,"spicyRequired":boolean,"allergens":string[],"diet":string[],"keywords":string[],"categories":string[]}
Ví dụ: "2 người 100k không cay" → {"budget":100000,"people":2,"spicyMax":0,"spicyRequired":false,"allergens":[],"diet":[],"keywords":[],"categories":[]}
Chỉ trả JSON.`;

/** Prompt viet cau tra loi: chi duoc nhac toi mon do server loc, khong tu bia. */
export const REPLY_PROMPT = `Bạn là chatbot tư vấn món ăn. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn.
CHỈ nhắc tới món trong DANH SÁCH. KHÔNG tự nghĩ ra món. Giá phải đúng.
DANH SÁCH MÓN: %s
CÂU HỎI: %s
Trả lời ngắn, mời khách bấm thẻ món.`;