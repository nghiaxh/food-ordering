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
