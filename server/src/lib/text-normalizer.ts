// Chuan hoa chu Viet de tim kiem khong dau: NFD tach dau khoi ky tu goc,
// bo ky tu ket hop; d/D khong co NFD nen thay tay.
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

const TEENCODE_NO = new Set(["ko", "k", "kh", "khg", "hok", "hem", "hong"]);

/**
 * Doi teencode "ko / k / kh / hok..." thanh "khong" truoc khi phan tich cau.
 * Ca regex lan model nho deu hieu "khong cay" tot hon "ko cay"; thieu buoc nay thi
 * "goi y mon ko cay" van tra ve mon cay.
 */
export function normalizeChat(input: string | null | undefined): string {
  if (!input) return "";
  // "100 k" gop lai thanh "100k", khong thi mat so tien khi tach tu.
  const joined = input.replace(/(\d)\s+(?=k\b)/gi, "$1");
  return joined
    .split(/(\s+)/)
    .map((token) => {
      const bare = token.replace(/[.,!?;:]+$/g, "").toLowerCase();
      if (!TEENCODE_NO.has(bare)) return token;
      return `không${token.slice(bare.length)}`;
    })
    .join("");
}
