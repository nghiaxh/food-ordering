import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { promotionRequestSchema } from "./schema.js";
import * as promotionService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

export const promotionAdminRouter = Router();

promotionAdminRouter.get("/promotions", async (_req, res) => {
  res.json(await promotionService.listPromotions());
});
promotionAdminRouter.post("/promotions", async (req, res) => {
  res.json(await promotionService.createPromotion(parseBody(promotionRequestSchema, req.body)));
});
promotionAdminRouter.put("/promotions/:id", async (req, res) => {
  res.json(await promotionService.updatePromotion(idParam(req.params.id), parseBody(promotionRequestSchema, req.body)));
});
promotionAdminRouter.delete("/promotions/:id", async (req, res) => {
  await promotionService.deletePromotion(idParam(req.params.id));
  res.json({});
});