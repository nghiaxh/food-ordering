/**
 * Mã QR giả lập cho bước thanh toán: tài liệu quy định phương thức này là mô phỏng, không nối
 * cổng thanh toán thật. Vì vậy ta chỉ sinh một lưới đen trắng đẹp mắt từ mã đơn, tuyệt đối không
 * mã hoá thông tin thật để khách không quét nhầm vào một mã nào đó ngoài hệ thống.
 */
const SIZE = 21
const FINDER = 7

function isFinderModule(x: number, y: number, ox: number, oy: number): boolean {
  const dx = x - ox
  const dy = y - oy
  if (dx < 0 || dy < 0 || dx >= FINDER || dy >= FINDER) return false
  const edge = dx === 0 || dy === 0 || dx === FINDER - 1 || dy === FINDER - 1
  const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
  return edge || core
}

/** Bit giả từ chuỗi mã đơn; chỉ dùng để tạo hình, không mang ý nghĩa mã hoá. */
function bit(text: string, index: number): boolean {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i) + index) >>> 0
  }
  return hash % 2 === 0
}

export default function FakeQr({ value, size = 168 }: { value: string; size?: number }) {
  const cells: boolean[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inFinder =
        isFinderModule(x, y, 0, 0) ||
        isFinderModule(x, y, SIZE - FINDER, 0) ||
        isFinderModule(x, y, 0, SIZE - FINDER)
      // Khoảng trắng quanh ba ô định vị giữ nguyên trắng để hình không bị méo.
      const nearFinder =
        (x < FINDER && y < FINDER) ||
        (x >= SIZE - FINDER && y < FINDER) ||
        (x < FINDER && y >= SIZE - FINDER)
      cells.push(nearFinder ? inFinder : bit(value, x + y * SIZE))
    }
  }

  const unit = size / SIZE
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Mã QR giả lập, không dùng để thanh toán thật"
      className="rounded-lg bg-white p-2"
    >
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % SIZE} y={Math.floor(i / SIZE)} width={unit} height={unit} fill="#111" /> : null,
      )}
    </svg>
  )
}