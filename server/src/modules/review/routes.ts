import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { createReviewSchema, updateReviewSchema } from "./schema.js";
import * as reviewService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const reviewRouter = Router();

// Route cong khai; optionalAuth de biet danh gia nao cua chinh nguoi dang dang nhap.
reviewRouter.get("/food/:foodId", optionalAuth, async (req, res) => {
  res.json(await reviewService.listByFood(idParam(req.params.foodId), req.user?.id));
});

reviewRouter.post("/", requireAuth, async (req, res) => {
  res.json(await reviewService.create(req.user!.id, parseBody(createReviewSchema, req.body)));
});

reviewRouter.put("/:id", requireAuth, async (req, res) => {
  res.json(await reviewService.update(req.user!.id, idParam(req.params.id), parseBody(updateReviewSchema, req.body)));
});

reviewRouter.delete("/:id", requireAuth, async (req, res) => {
  await reviewService.remove(req.user!.id, idParam(req.params.id));
  res.json({});
});
