import { Router } from "express";
import multer from "multer";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { documentRequestSchema, settingSaveSchema } from "./schema.js";
import * as chatbotService from "./service.js";
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

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const chatbotAdminRouter = Router();

chatbotAdminRouter.get("/chatbot/history", async (_req, res) => {
  res.json(await chatbotService.chatHistory());
});
chatbotAdminRouter.get("/chatbot/settings", async (_req, res) => {
  res.json(await chatbotService.listAiSettings());
});
chatbotAdminRouter.put("/chatbot/settings", async (req, res) => {
  const body = parseBody(settingSaveSchema, req.body);
  res.json(await chatbotService.saveAiSetting(body.settingKey, body.settingValue));
});

chatbotAdminRouter.get("/chatbot/documents", async (_req, res) => {
  res.json(await listDocuments());
});
chatbotAdminRouter.get("/chatbot/documents/stats", async (_req, res) => {
  res.json(await documentStats());
});
chatbotAdminRouter.get("/chatbot/documents/:id/chunks", async (req, res) => {
  res.json(await listChunks(idParam(req.params.id)));
});
chatbotAdminRouter.post("/chatbot/documents", async (req, res) => {
  const body = parseBody(documentRequestSchema, req.body);
  res.json(await ingestText(body.title, body.category ?? null, body.keywords ?? null, body.content, body.enabled));
});
chatbotAdminRouter.put("/chatbot/documents/:id", async (req, res) => {
  const body = parseBody(documentRequestSchema, req.body);
  res.json(await updateDocument(idParam(req.params.id), {
    title: body.title,
    category: body.category ?? null,
    keywords: body.keywords ?? null,
    content: body.content,
    enabled: body.enabled,
  }));
});
chatbotAdminRouter.delete("/chatbot/documents/:id", async (req, res) => {
  await deleteDocument(idParam(req.params.id));
  res.json({});
});
chatbotAdminRouter.post("/chatbot/documents/upload", documentUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file || file.size === 0) throw badRequest("Tệp rỗng");
  const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : null;
  const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim() : null;
  const keywords = typeof req.body?.keywords === "string" && req.body.keywords.trim() ? req.body.keywords.trim() : null;
  res.json(await ingestFile(file.originalname || "document.txt", file.buffer, title, category, keywords));
});
chatbotAdminRouter.post("/chatbot/documents/:id/reingest", async (req, res) => {
  res.json(await reingestDocument(idParam(req.params.id)));
});