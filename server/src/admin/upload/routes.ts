import { Router } from "express";
import multer from "multer";
import { badRequest } from "../../lib/errors.js";
import * as uploadService from "./service.js";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadAdminRouter = Router();

uploadAdminRouter.post("/uploads/image", imageUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file || file.size === 0) throw badRequest("Ảnh phải có dung lượng từ 1 byte đến 2 MB");
  const { url } = await uploadService.saveImage(file.buffer, req.get("host") ?? "localhost:8080", req.protocol);
  res.json({ url });
});