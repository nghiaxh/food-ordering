export const formatVND = (value: number | string) => `${Number(value).toLocaleString('vi-VN')}đ`

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  if (diff < MINUTE) return 'Vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`
  if (diff < 2 * DAY) return 'Hôm qua'
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} ngày trước`
  return date.toLocaleDateString('vi-VN')
}