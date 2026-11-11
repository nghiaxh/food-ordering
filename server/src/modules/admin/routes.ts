// API quan tri: mon/danh muc/don/khach hang/khuyen mai/chatbot/tai lieu/bao cao/upload.

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { parseBody, parseQuery } from "../../lib/validate.js";
import { requireRole } from "../../middleware/auth.js";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createFood,
  updateFood,
  deleteFood,
} from "../../user/menu/service.js";
import { adminOrderSchema } from "../../user/order/schema.js";
import * as orderService from "../../user/order/service.js";
import * as adminService from "./service.js";
import {
  foodRequestSchema,
  categoryRequestSchema,
  adminUserSchema,
  promotionRequestSchema,
  promotionSaveSchema,
  documentRequestSchema,
  updateStatusRequestSchema,
} from "./schema.js";
import { summary, revenueByDay, topFoods, exportExcel, parseRange } from "./report.js";
import {
  listDocuments,
  documentStats,
  listChunks,
  updateDocument,
  ingestText,
  ingestFile,
  reingestDocument,
  deleteDocument,
} from "../../user/chatbot/ingest.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminRouter = Router();

// Toan bo khu vuc quan tri yeu cau role ADMIN; route guard phia client chi la UX.
adminRouter.use(requireRole("ADMIN"));

// ----- Mon an -----
adminRouter.post("/foods", async (req, res) => {
  res.json(await createFood(parseBody(foodRequestSchema, req.body)));
});
adminRouter.put("/foods/:id", async (req, res) => {
  res.json(await updateFood(idParam(req.params.id), parseBody(foodRequestSchema, req.body)));
});
adminRouter.delete("/foods/:id", async (req, res) => {
  await deleteFood(idParam(req.params.id));
  res.json({});
});

// ----- Danh muc -----
adminRouter.post("/categories", async (req, res) => {
  res.json(await createCategory(parseBody(categoryRequestSchema, req.body)));
});
adminRouter.put("/categories/:id", async (req, res) => {
  res.json(await updateCategory(idParam(req.params.id), parseBody(categoryRequestSchema, req.body)));
});
adminRouter.delete("/categories/:id", async (req, res) => {
  await deleteCategory(idParam(req.params.id));
  res.json({});
});

// ----- Don hang -----
adminRouter.get("/orders", async (_req, res) => {
  res.json(await orderService.adminListOrders());
});
adminRouter.post("/orders", async (req, res) => {
  res.json(await orderService.adminCreateOrder(parseBody(adminOrderSchema, req.body)));
});
adminRouter.put("/orders/:id", async (req, res) => {
  res.json(await orderService.adminUpdateOrder(idParam(req.params.id), parseBody(adminOrderSchema, req.body)));
});
adminRouter.delete("/orders/:id", async (req, res) => {
  await orderService.adminDeleteOrder(idParam(req.params.id));
  res.json({});
});
adminRouter.patch("/orders/:id/status", async (req, res) => {
  const body = parseBody(updateStatusRequestSchema, req.body);
  res.json(await orderService.adminUpdateStatus(idParam(req.params.id), body.status));
});
adminRouter.patch("/orders/:id/payment", async (req, res) => {
  const paidRaw = String(req.query.paid ?? "");
  if (paidRaw !== "true" && paidRaw !== "false") throw badRequest("Thiếu tham số paid (true/false)");
  const order = await orderService.adminGetOrder(idParam(req.params.id));
  res.json(await orderService.updatePaymentStatus(order, paidRaw === "true"));
});

// ----- Khach hang -----
adminRouter.get("/users", async (_req, res) => {
  res.json(await adminService.listUsers());
});
adminRouter.post("/users", async (req, res) => {
  res.json(await adminService.adminCreateUser(parseBody(adminUserSchema, req.body)));
});
adminRouter.put("/users/:id", async (req, res) => {
  res.json(await adminService.adminUpdateUser(idParam(req.params.id), parseBody(adminUserSchema, req.body)));
});
adminRouter.delete("/users/:id", async (req, res) => {
  await adminService.adminDeleteUser(idParam(req.params.id));
  res.json({});
});
adminRouter.patch("/users/:id/active", async (req, res) => {
  const activeRaw = String(req.query.active ?? "");
  if (activeRaw !== "true" && activeRaw !== "false") throw badRequest("Thiếu tham số active (true/false)");
  res.json(await adminService.setUserActive(idParam(req.params.id), activeRaw === "true"));
});

// ----- Khuyen mai -----
adminRouter.get("/promotions", async (_req, res) => {
  res.json(await adminService.listPromotions());
});
adminRouter.post("/promotions", async (req, res) => {
  res.json(await adminService.createPromotion(parseBody(promotionRequestSchema, req.body)));
});
adminRouter.put("/promotions/:id", async (req, res) => {
  res.json(await adminService.updatePromotion(idParam(req.params.id), parseBody(promotionRequestSchema, req.body)));
});
adminRouter.delete("/promotions/:id", async (req, res) => {
  await adminService.deletePromotion(idParam(req.params.id));
  res.json({});
});

// ----- Chatbot: lich su hoi thoai + cau hinh -----
adminRouter.get("/chatbot/history", async (_req, res) => {
  res.json(await adminService.chatHistory());
});
adminRouter.get("/chatbot/settings", async (_req, res) => {
  res.json(await adminService.listAiSettings());
});
adminRouter.put("/chatbot/settings", async (req, res) => {
  const body = parseBody(promotionSaveSchema, req.body);
  res.json(await adminService.saveAiSetting(body.settingKey, body.settingValue));
});

// ----- Chatbot: tai lieu (RAG tsvector) -----
adminRouter.get("/chatbot/documents", async (_req, res) => {
  res.json(await listDocuments());
});
adminRouter.get("/chatbot/documents/stats", async (_req, res) => {
  res.json(await documentStats());
});
adminRouter.get("/chatbot/documents/:id/chunks", async (req, res) => {
  res.json(await listChunks(idParam(req.params.id)));
});
adminRouter.post("/chatbot/documents", async (req, res) => {
  const body = parseBody(documentRequestSchema, req.body);
  res.json(await ingestText(body.title, body.category ?? null, body.keywords ?? null, body.content, body.enabled));
});
adminRouter.put("/chatbot/documents/:id", async (req, res) => {
  const body = parseBody(documentRequestSchema, req.body);
  res.json(await updateDocument(idParam(req.params.id), {
    title: body.title,
    category: body.category ?? null,
    keywords: body.keywords ?? null,
    content: body.content,
    enabled: body.enabled,
  }));
});
adminRouter.delete("/chatbot/documents/:id", async (req, res) => {
  await deleteDocument(idParam(req.params.id));
  res.json({});
});
adminRouter.post("/chatbot/documents/upload", documentUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file || file.size === 0) throw badRequest("Tệp rỗng");
  const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : null;
  const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim() : null;
  const keywords = typeof req.body?.keywords === "string" && req.body.keywords.trim() ? req.body.keywords.trim() : null;
  res.json(await ingestFile(file.originalname || "document.txt", file.buffer, title, category, keywords));
});
adminRouter.post("/chatbot/documents/:id/reingest", async (req, res) => {
  res.json(await reingestDocument(idParam(req.params.id)));
});

// ----- Upload anh mon (JPEG/PNG/WEBP ≤ 2 MB, kiem chu ky dau file) -----
adminRouter.post("/uploads/image", imageUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file || file.size === 0) throw badRequest("Ảnh phải có dung lượng từ 1 byte đến 2 MB");
  const { url } = await adminService.saveImage(file.buffer, req.get("host") ?? "localhost:8080", req.protocol);
  res.json({ url });
});

// ----- Bao cao + xuat Excel -----
adminRouter.get("/reports/summary", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await summary(parseRange(query.from, query.to)));
});
adminRouter.get("/reports/revenue", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await revenueByDay(parseRange(query.from, query.to)));
});
adminRouter.get("/reports/top-foods", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await topFoods(parseRange(query.from, query.to), query.limit ?? 10));
});
adminRouter.get("/reports/export", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  const data = await exportExcel(parseRange(query.from, query.to));
  res
    .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader("Content-Disposition", 'attachment; filename="bao-cao.xlsx"')
    .send(data);
});
