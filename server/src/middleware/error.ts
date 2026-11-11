import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors.js";

interface DatabaseError {
  code?: string;
  detail?: string;
}

/**
 * Handler loi cuoi cung: client chi nhan `{ message }` tieng Viet, chi tiet ky thuat nam o log.
 * Tranh lo ten bang/rang buoc CSDL ra ngoai nhu khi exception lot thang.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  // Bat loi co so du lieu PostgreSQL (qua pg driver/Drizzle)
  if (isDatabaseError(err)) {
    // 23505: unique_violation
    if (err.code === "23505") {
      res.status(409).json({ message: "Dữ liệu đã tồn tại, không thể tạo trùng." });
      return;
    }
    // 23503: foreign_key_violation
    if (err.code === "23503") {
      res.status(409).json({
        message:
          "Dữ liệu đang được tham chiếu ở nơi khác, không thể xoá. Hãy khoá bản ghi thay vì xoá để giữ dữ liệu.",
      });
      return;
    }
  }

  // Body JSON sai cu phap do express.json() nem ra.
  if (isBodyParseError(err)) {
    res.status(400).json({ message: "Dữ liệu gửi lên không hợp lệ." });
    return;
  }
  if (isMulterLimit(err)) {
    res.status(400).json({ message: "Tệp tải lên vượt quá dung lượng cho phép." });
    return;
  }
  console.error("Lỗi không xử lý được:", err);
  res.status(500).json({ message: "Đã có lỗi xảy ra, vui lòng thử lại sau." });
}

const isDatabaseError = (err: unknown): err is DatabaseError =>
  typeof err === "object" && err !== null && "code" in err;

const isBodyParseError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.parse.failed";

const isMulterLimit = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "LIMIT_FILE_SIZE";
