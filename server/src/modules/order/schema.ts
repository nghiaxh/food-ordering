import { z } from "zod";

/** Hai phương thức thanh toán: COD (tiền mặt khi nhận) và QR (quét mã chuyển khoản). */
export const PAYMENT_METHOD_PATTERN = /^(COD|QR)$/;

const phoneSchema = z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số");
const noteSchema = z.string().max(255, "Lưu ý không được vượt quá 255 ký tự").optional();

export const orderItemRequestSchema = z.object({
  foodId: z.number().int().positive("Món ăn không hợp lệ"),
  quantity: z.number().int().min(1, "Số lượng món phải lớn hơn 0"),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemRequestSchema).min(1, "Giỏ hàng rỗng"),
  receiverName: z.string().min(1, "Nhập tên người nhận"),
  phone: phoneSchema,
  address: z.string().min(1, "Nhập địa chỉ giao hàng"),
  paymentMethod: z.string().regex(PAYMENT_METHOD_PATTERN, "Phương thức thanh toán không hợp lệ"),
  note: noteSchema,
});

export const adminOrderSchema = z.object({
  customerEmail: z.string().email("Email không hợp lệ"),
  // items được phép null khi chỉ sửa thông tin giao hàng của đơn đã xác nhận.
  items: z.array(orderItemRequestSchema).optional(),
  receiverName: z.string().min(1, "Nhập tên người nhận"),
  phone: z.string().min(1, "Nhập số điện thoại"),
  address: z.string().min(1, "Nhập địa chỉ giao hàng"),
  paymentMethod: z.string().regex(PAYMENT_METHOD_PATTERN, "Phương thức thanh toán không hợp lệ"),
  note: noteSchema,
  status: z.string().optional(),
  paid: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1, "Trạng thái không được để trống"),
});
