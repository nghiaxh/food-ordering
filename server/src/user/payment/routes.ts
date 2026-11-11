import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { requireRole } from "../../middleware/auth.js";
import * as paymentService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const paymentRouter = Router();

paymentRouter.use(requireRole("CUSTOMER"));

paymentRouter.patch("/:id/pay", async (req, res) => {
  res.json(await paymentService.payOrder(req.user!.email, idParam(req.params.id)));
});