// Mui gio nghiep vu cua quan la gio Viet Nam. May chu (dev, docker, CI) chay UTC nen
// Date.getHours()/getDay()/toISOString() doc sai ngay va khung gio — moi cho can "ngay/thu/gio"
// lich cua khach hang phai di qua helper nay, khong doc truc tiep Date.
export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Offset co dinh +07:00 — Viet Nam khong co DST nen khong can
 *  xu ly theo mua. Dung cho cac moc ISO "YYYY-MM-DDT..." can nghia theo ngay VN. */
export const BUSINESS_UTC_OFFSET = "+07:00";

export interface BusinessTimeParts {
  /** Ngay lich VN dang YYYY-MM-DD — khoa nhom "Mon may man moi ngay" va doanh thu theo ngay. */
  dayKey: string;
  /** Thu viet hoa 3 ky tu (SUN..SAT), khop `daysOfWeek` trong khuyen mai. */
  weekday: string;
  /** So phut tinh tu 00:00 gio VN — so voi `startTime`/`endTime`. */
  minutes: number;
}

// Tach formatter ra module-level: isValid chay trong vong lap theo tung dong gio hang,
// khong dung Intl.DateTimeFormat moi lan goi.
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

/** Doc `now` theo gio Viet Nam: ngay lich, thu va phut trong ngay (khong phu thuoc TZ may chu). */
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
