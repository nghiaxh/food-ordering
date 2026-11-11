// Chuan hoa chu Viet phuc vu tim kiem khong dau: "Pho bo" va "pho bo" chung mot dang.
// Dung NFD tach dau khoi ky tu goc roi bo ky tu ket hop; d/D khong co NFD nen thay tay.
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
