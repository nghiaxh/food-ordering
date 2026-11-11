import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { parseBody, parseQuery } from "../../lib/validate.js";
import { summary, revenueByDay, topFoods, exportExcel, parseRange } from "./service.js";

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const reportAdminRouter = Router();

reportAdminRouter.get("/reports/summary", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await summary(parseRange(query.from, query.to)));
});
reportAdminRouter.get("/reports/revenue", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await revenueByDay(parseRange(query.from, query.to)));
});
reportAdminRouter.get("/reports/top-foods", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await topFoods(parseRange(query.from, query.to), query.limit ?? 10));
});
reportAdminRouter.get("/reports/export", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  const data = await exportExcel(parseRange(query.from, query.to));
  res
    .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader("Content-Disposition", 'attachment; filename="bao-cao.xlsx"')
    .send(data);
});