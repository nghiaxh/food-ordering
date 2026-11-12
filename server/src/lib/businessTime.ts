// Mui gio nghiep vu cua quan la gio Viet Nam; server (dev/docker/CI) chay UTC.
// Code can "ngay/thu/gio" cua khach phai di qua helper nay, khong doc truc tiep Date.
import { badRequest } from "./errors.js";

export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Offset co dinh +07:00 - Viet Nam khong co DST nen khong can
 *  xu ly theo mua. Dung cho cac moc ISO "YYYY-MM-DDT..." can nghia theo ngay VN. */
export const BUSINESS_UTC_OFFSET = "+07:00";

export interface BusinessTimeParts {
  /** Ngay lich VN dang YYYY-MM-DD - khoa nhom "Mon may man moi ngay" va doanh thu theo ngay. */
  dayKey: string;
  /** Thu viet hoa 3 ky tu (SUN..SAT), khop `daysOfWeek` trong khuyen mai. */
  weekday: string;
  /** So phut tinh tu 00:00 gio VN - so voi `startTime`/`endTime`. */
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
    weekday, // en-US "Sun".."Sat" -> "SUN".."SAT"
    minutes: hour * 60 + minute,
  };
};

/** Ngay lich dang "YYYY-MM-DD" - nguoi dung nhap ngay theo lich Viet Nam. */
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface BusinessRange {
  from: Date;
  to: Date;
}

/**
 * Doc moc thoi gian tu chuoi: "YYYY-MM-DD" la ngay lich VN (dau hoac cuoi ngay theo gio Viet),
 * chuoi ISO datetime giu nguyen instant. Chuoi sai tra loi 400 thay vi loi 500.
 */
export const parseBusinessDate = (raw: string, endOfDay = false): Date => {
  const value = raw.trim();
  if (PLAIN_DAY.test(value)) {
    const day = new Date(
      endOfDay
        ? `${value}T23:59:59.999${BUSINESS_UTC_OFFSET}`
        : `${value}T00:00:00${BUSINESS_UTC_OFFSET}`,
    );
    // Date tu cua V8 cuon ngay sai ("2026-02-31" ra "2026-03-03") nen doi chieu ngay lich.
    if (Number.isNaN(day.getTime()) || businessTimeParts(day).dayKey !== value) {
      throw badRequest("Khoảng ngày không hợp lệ");
    }
    return day;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw badRequest("Khoảng ngày không hợp lệ");
  return parsed;
};

/**
 * Khoang thoi gian cho bao cao: "YYYY-MM-DD" la ngay lich VN, mac dinh 30 ngay gan nhat.
 * Ngay bat dau phai khong sau ngay ket thuc.
 */
export const parseBusinessRange = (fromRaw?: string, toRaw?: string): BusinessRange => {
  const now = new Date();
  const from = fromRaw ? parseBusinessDate(fromRaw) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const to = toRaw ? parseBusinessDate(toRaw, true) : now;
  if (from.getTime() > to.getTime()) {
    throw badRequest("Khoảng ngày không hợp lệ: ngày bắt đầu phải không sau ngày kết thúc");
  }
  return { from, to };
};
