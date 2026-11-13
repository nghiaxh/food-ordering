import { Router } from "express";
import multer from "multer";
import { badRequest } from "../../lib/errors.js";
import * as uploadService from "./service.js";
import { ALLOWED_IMAGE_MIME } from "./service.js";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  // Chan sai dang ngay tai middleware; LIMIT_FILE_SIZE da duoc error middleware doi thanh 400.
  // saveImage van kiem chu ky magic byte nen file doi duoi gian MIME van bi loai.
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.includes(file.mimetype)) cb(null, true);
    else cb(badRequest("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"));
  },
});

export const uploadAdminRouter = Router();

uploadAdminRouter.post("/uploads/image", imageUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file || file.size === 0) throw badRequest("Ảnh phải có dung lượng từ 1 byte đến 2 MB");
  const { url } = await uploadService.saveImage(file.buffer, req.get("host") ?? "localhost:8080", req.protocol);
  res.json({ url });
});