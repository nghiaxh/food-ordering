import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../lib/errors.js";

/**
 * Handler lỗi cuối cùng: client chỉ nhận `{ message }` tiếng Việt, chi tiết kỹ thuật nằm ở log.
 * Tránh lộ tên bảng/ràng buộc CSDL ra ngoài như khi exception lọt thẳng.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 trùng giá trị unique; P2003 vi phạm khoá ngoại; P2025 không tìm thấy bản ghi.
    if (err.code === "P2002") {
      res.status(409).json({ message: "Dữ liệu đã tồn tại, không thể tạo trùng." });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ message: "Dữ liệu đang được tham chiếu ở nơi khác, không thể xoá. Hãy khoá bản ghi thay vì xoá để giữ dữ liệu." });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Không tìm thấy dữ liệu." });
      return;
    }
  }
  // Body JSON sai cú pháp do express.json() ném ra.
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

const isBodyParseError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.parse.failed";

const isMulterLimit = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "LIMIT_FILE_SIZE";
