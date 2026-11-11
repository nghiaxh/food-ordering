import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import * as orderService from "../order/service.js";
import * as paymentService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

export const paymentAdminRouter = Router();

paymentAdminRouter.patch("/orders/:id/payment", async (req, res) => {
  const paidRaw = String(req.query.paid ?? "");
  if (paidRaw !== "true" && paidRaw !== "false") throw badRequest("Thiếu tham số paid (true/false)");
  const order = await orderService.adminGetOrder(idParam(req.params.id));
  res.json(await paymentService.updatePaymentStatus(order, paidRaw === "true"));
});