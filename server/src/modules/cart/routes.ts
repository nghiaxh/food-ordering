import { Router } from "express";
import { parseBody } from "../../lib/validate.js";
import { badRequest } from "../../lib/errors.js";
import { requireRole } from "../../middleware/auth.js";
import { addCartItemSchema, quoteRequestSchema, updateCartItemSchema } from "./schema.js";
import * as cartService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const cartRouter = Router();

// Giỏ hàng chỉ dành cho tài khoản khách hàng; admin dùng luồng /api/admin/orders.
cartRouter.use(requireRole("CUSTOMER"));

cartRouter.get("/", async (req, res) => {
  res.json(await cartService.listCart(req.user!.email));
});

cartRouter.post("/items", async (req, res) => {
  const body = parseBody(addCartItemSchema, req.body);
  res.json(await cartService.addToCart(req.user!.email, body.foodId, body.quantity));
});

cartRouter.patch("/items/:foodId", async (req, res) => {
  const body = parseBody(updateCartItemSchema, req.body);
  res.json(await cartService.updateCartItem(req.user!.email, idParam(req.params.foodId), body.quantity));
});

cartRouter.delete("/items/:foodId", async (req, res) => {
  await cartService.removeCartItem(req.user!.email, idParam(req.params.foodId));
  res.json({});
});

cartRouter.delete("/", async (req, res) => {
  await cartService.clearCart(req.user!.email);
  res.json({});
});

cartRouter.post("/quote", async (req, res) => {
  const body = parseBody(quoteRequestSchema, req.body);
  res.json(await cartService.quote(body.items));
});
