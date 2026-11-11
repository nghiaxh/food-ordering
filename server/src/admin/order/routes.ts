import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { adminOrderSchema, updateStatusRequestSchema } from "./schema.js";
import * as orderService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

export const orderAdminRouter = Router();

orderAdminRouter.get("/orders", async (_req, res) => {
  res.json(await orderService.adminListOrders());
});
orderAdminRouter.post("/orders", async (req, res) => {
  res.json(await orderService.adminCreateOrder(parseBody(adminOrderSchema, req.body)));
});
orderAdminRouter.put("/orders/:id", async (req, res) => {
  res.json(await orderService.adminUpdateOrder(idParam(req.params.id), parseBody(adminOrderSchema, req.body)));
});
orderAdminRouter.delete("/orders/:id", async (req, res) => {
  await orderService.adminDeleteOrder(idParam(req.params.id));
  res.json({});
});
orderAdminRouter.patch("/orders/:id/status", async (req, res) => {
  const body = parseBody(updateStatusRequestSchema, req.body);
  res.json(await orderService.adminUpdateStatus(idParam(req.params.id), body.status));
});