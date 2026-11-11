import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as notificationService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get("/", async (req, res) => {
  res.json(await notificationService.listNotifications(req.user!.email));
});

notificationRouter.post("/read-all", async (req, res) => {
  await notificationService.markAllRead(req.user!.email);
  res.json({});
});

notificationRouter.delete("/read", async (req, res) => {
  await notificationService.deleteRead(req.user!.email);
  res.json({});
});

notificationRouter.post("/:id/read", async (req, res) => {
  await notificationService.markRead(req.user!.email, idParam(req.params.id));
  res.json({});
});

notificationRouter.delete("/:id", async (req, res) => {
  await notificationService.deleteOne(req.user!.email, idParam(req.params.id));
  res.json({});
});
