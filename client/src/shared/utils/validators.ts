/**
 * Ràng buộc biên dùng chung toàn bộ client. Server kiểm lại bằng `^0\d{9}$` nên
 * thông báo phải khớp đúng từng chữ với TEST.md, không đổi tự do.
 */
export const PHONE_PATTERN = /^0\d{9}$/

export const PHONE_RULE = { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số' }
