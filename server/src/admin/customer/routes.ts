import { Router } from "express";
import { badRequest } from "../../lib/errors.js";
import { parseBody } from "../../lib/validate.js";
import { adminUserSchema } from "./schema.js";
import * as customerService from "./service.js";

const idParam = (raw: string | string[] | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID không hợp lệ");
  return id;
};

export const customerAdminRouter = Router();

customerAdminRouter.get("/users", async (_req, res) => {
  res.json(await customerService.listUsers());
});
customerAdminRouter.post("/users", async (req, res) => {
  res.json(await customerService.adminCreateUser(parseBody(adminUserSchema, req.body)));
});
customerAdminRouter.put("/users/:id", async (req, res) => {
  res.json(await customerService.adminUpdateUser(idParam(req.params.id), parseBody(adminUserSchema, req.body)));
});
customerAdminRouter.delete("/users/:id", async (req, res) => {
  await customerService.adminDeleteUser(idParam(req.params.id));
  res.json({});
});
customerAdminRouter.patch("/users/:id/active", async (req, res) => {
  const activeRaw = String(req.query.active ?? "");
  if (activeRaw !== "true" && activeRaw !== "false") throw badRequest("Thiếu tham số active (true/false)");
  res.json(await customerService.setUserActive(idParam(req.params.id), activeRaw === "true"));
});