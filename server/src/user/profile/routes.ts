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

export const profileRouter = Router();

// Dia chi da luu chi co y nghia khi dang nhap; guard theo tung route de router mount o "/api"
// khong chan cac route mount truoc/sau no. Moi endpoint o day deu yeu cau dang nhap.
profileRouter.get("/addresses", requireAuth, async (req, res) => {
  res.json(await userService.listAddresses(req.user!.email));
});

profileRouter.post("/addresses", requireAuth, async (req, res) => {
  res.json(await userService.createAddress(req.user!.email, parseBody(addressRequestSchema, req.body)));
});

profileRouter.put("/addresses/:id", requireAuth, async (req, res) => {
  res.json(await userService.updateAddress(req.user!.email, idParam(req.params.id), parseBody(addressRequestSchema, req.body)));
});

profileRouter.patch("/addresses/:id/default", requireAuth, async (req, res) => {
  res.json(await userService.setDefaultAddress(req.user!.email, idParam(req.params.id)));
});

profileRouter.delete("/addresses/:id", requireAuth, async (req, res) => {
  await userService.deleteAddress(req.user!.email, idParam(req.params.id));
  res.json({});
});
