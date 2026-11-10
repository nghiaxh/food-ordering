// Múi giờ nghiệp vụ của quán là giờ Việt Nam. Máy chủ (dev, docker, CI) chạy UTC nên
// Date.getHours()/getDay()/toISOString() đọc sai ngày và khung giờ — mọi chỗ cần "ngày/thứ/giờ"
// lịch của khách hàng phải đi qua helper này, không đọc trực tiếp Date.
export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Offset cố định +07:00 — Việt Nam không có DST nên không cần
 *  xử lý theo mùa. Dùng cho các mốc ISO "YYYY-MM-DDT..." cần nghĩa theo ngày VN. */
export const BUSINESS_UTC_OFFSET = "+07:00";

export interface BusinessTimeParts {
  /** Ngày lịch VN dạng YYYY-MM-DD — khóa nhóm "Món may mắn mỗi ngày" và doanh thu theo ngày. */
  dayKey: string;
  /** Thứ viết hoa 3 ký tự (SUN..SAT), khớp `daysOfWeek` trong khuyến mãi. */
  weekday: string;
  /** Số phút tính từ 00:00 giờ VN — so với `startTime`/`endTime`. */
  minutes: number;
}

// Tách formatter ra module-level: isValid chạy trong vòng lặp theo từng dòng giỏ hàng,
// không dựng Intl.DateTimeFormat mỗi lần gọi.
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Đọc `now` theo giờ Việt Nam: ngày lịch, thứ và phút trong ngày (không phụ thuộc TZ máy chủ). */
export const businessTimeParts = (now: Date): BusinessTimeParts => {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  const year = parts.year ?? "1970";
  const month = parts.month ?? "01";
  const day = parts.day ?? "01";
  const weekday = (parts.weekday ?? "Sun").toUpperCase();
  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  return {
    dayKey: `${year}-${month}-${day}`,
    weekday, // en-US "Sun".."Sat" → "SUN".."SAT"
    minutes: hour * 60 + minute,
  };
};
