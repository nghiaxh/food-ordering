import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { parseQuery } from "../../lib/validate.js";
import { getFood, listCategories, searchFoods } from "./service.js";

const searchSchema = z.object({
  keyword: z.string().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const menuRouter = Router();

menuRouter.get("/categories", async (_req, res) => {
  res.json(await listCategories());
});

menuRouter.get("/foods", async (req, res) => {
  const query = parseQuery(searchSchema, req.query);
  res.json(await searchFoods(query));
});

menuRouter.get("/foods/:id", async (req, res) => {
  res.json(await getFood(idParam(req.params.id)));
});
