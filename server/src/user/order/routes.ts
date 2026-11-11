import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { requireRole } from "../../middleware/auth.js";
import { createOrderSchema } from "./schema.js";
import * as orderService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const orderRouter = Router();

// Don hang chi danh cho tai khoan khach hang; admin dung luong /api/admin/orders.
orderRouter.use(requireRole("CUSTOMER"));

orderRouter.post("/", async (req, res) => {
  res.json(await orderService.createOrder(req.user!.email, parseBody(createOrderSchema, req.body)));
});

orderRouter.get("/my", async (req, res) => {
  res.json(await orderService.myOrders(req.user!.email));
});

orderRouter.patch("/:id/cancel", async (req, res) => {
  res.json(await orderService.cancelOrder(req.user!.email, idParam(req.params.id)));
});

orderRouter.patch("/:id/pay", async (req, res) => {
  res.json(await orderService.payOrder(req.user!.email, idParam(req.params.id)));
});
