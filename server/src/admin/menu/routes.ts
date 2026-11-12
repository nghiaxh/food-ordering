import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createFood,
  updateFood,
  deleteFood,
} from "./service.js";
import {
  foodRequestSchema,
  categoryRequestSchema,
} from "./schema.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

export const menuAdminRouter = Router();

// Mon an
menuAdminRouter.post("/foods", async (req, res) => {
  res.json(await createFood(parseBody(foodRequestSchema, req.body)));
});
menuAdminRouter.put("/foods/:id", async (req, res) => {
  res.json(await updateFood(idParam(req.params.id), parseBody(foodRequestSchema, req.body)));
});
menuAdminRouter.delete("/foods/:id", async (req, res) => {
  await deleteFood(idParam(req.params.id));
  res.json({});
});

// Danh muc
menuAdminRouter.post("/categories", async (req, res) => {
  res.json(await createCategory(parseBody(categoryRequestSchema, req.body)));
});
menuAdminRouter.put("/categories/:id", async (req, res) => {
  res.json(await updateCategory(idParam(req.params.id), parseBody(categoryRequestSchema, req.body)));
});
menuAdminRouter.delete("/categories/:id", async (req, res) => {
  await deleteCategory(idParam(req.params.id));
  res.json({});
});
