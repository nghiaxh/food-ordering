// Chuẩn hoá chữ Việt phục vụ tìm kiếm không dấu: "Phở bò" và "pho bo" chung một dạng.
// Dùng NFD tách dấu khỏi ký tự gốc rồi bỏ ký tự kết hợp; đ/Đ không có NFD nên thay tay.
export function plain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
