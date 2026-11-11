/**
 * Rang buoc bien dung chung toan bo client. Server kiem lai bang `^0\d{9}$` nen
 * thong bao phai khop dung tung chu voi TEST.md, khong doi tu do.
 */
export const PHONE_PATTERN = /^0\d{9}$/

export const PHONE_RULE = { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số' }
