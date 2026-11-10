import { z } from "zod";
import { badRequest } from "./errors.js";

/** Validate body theo zod; lỗi trả 400 kèm thông báo tiếng Việt đầu tiên thay vì ném ZodError ra ngoài. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.");
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.output<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Tham số truy vấn không hợp lệ.");
  }
  return result.data;
}
