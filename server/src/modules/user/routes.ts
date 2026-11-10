import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { addressRequestSchema } from "./schema.js";
import * as userService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw badRequest("ID không hợp lệ");
  return id;
};

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get("/addresses", async (req, res) => {
  res.json(await userService.listAddresses(req.user!.email));
});

userRouter.post("/addresses", async (req, res) => {
  res.json(await userService.createAddress(req.user!.email, parseBody(addressRequestSchema, req.body)));
});

userRouter.put("/addresses/:id", async (req, res) => {
  res.json(await userService.updateAddress(req.user!.email, idParam(req.params.id), parseBody(addressRequestSchema, req.body)));
});

userRouter.patch("/addresses/:id/default", async (req, res) => {
  res.json(await userService.setDefaultAddress(req.user!.email, idParam(req.params.id)));
});

userRouter.delete("/addresses/:id", async (req, res) => {
  await userService.deleteAddress(req.user!.email, idParam(req.params.id));
  res.json({});
});
