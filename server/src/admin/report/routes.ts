import { Router } from "express";
import { z } from "zod";
import { parseBusinessRange } from "../../lib/businessTime.js";
import { parseQuery } from "../../lib/validate.js";
import { summary, revenueByDay, topFoods, exportExcel } from "./service.js";

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const reportAdminRouter = Router();

reportAdminRouter.get("/reports/summary", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await summary(parseBusinessRange(query.from, query.to)));
});
reportAdminRouter.get("/reports/revenue", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await revenueByDay(parseBusinessRange(query.from, query.to)));
});
reportAdminRouter.get("/reports/top-foods", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  res.json(await topFoods(parseBusinessRange(query.from, query.to), query.limit ?? 10));
});
reportAdminRouter.get("/reports/export", async (req, res) => {
  const query = parseQuery(reportQuerySchema, req.query);
  const data = await exportExcel(parseBusinessRange(query.from, query.to));
  res
    .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader("Content-Disposition", 'attachment; filename="bao-cao.xlsx"')
    .send(data);
});