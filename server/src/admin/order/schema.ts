import { z } from "zod";
import {
  PAYMENT_METHOD_PATTERN,
  orderItemRequestSchema,
  noteSchema,
  phoneSchema,
} from "../../user/order/schema.js";

export const adminOrderSchema = z.object({
  customerEmail: z.string().email("Email không hợp lệ"),
  // items duoc phep null khi chi sua thong tin giao hang cua don da xac nhan.
  items: z.array(orderItemRequestSchema).optional(),
  receiverName: z.string().min(1, "Nhập tên người nhận"),
  phone: phoneSchema,
  address: z.string().min(1, "Nhập địa chỉ giao hàng"),
  paymentMethod: z.string().regex(PAYMENT_METHOD_PATTERN, "Phương thức thanh toán không hợp lệ"),
  note: noteSchema,
  status: z.string().optional(),
  paid: z.boolean().optional(),
});

export const updateStatusRequestSchema = z.object({
  status: z.string().min(1, "Trạng thái không được để trống"),
});