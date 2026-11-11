import { Router } from "express";
import { parseBody } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./schema.js";
import * as authService from "./service.js";

export const authRouter = Router();

// Ket qua tra 200 ke ca dang ky (giu dung hanh vi ban Java, client khong doc ma trang thai).
authRouter.post("/register", async (req, res) => {
  res.json(await authService.register(parseBody(registerSchema, req.body)));
});

authRouter.post("/login", async (req, res) => {
  res.json(await authService.login(parseBody(loginSchema, req.body)));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await authService.getMe(req.user!.email));
});

authRouter.put("/me", requireAuth, async (req, res) => {
  res.json(await authService.updateMe(req.user!.email, parseBody(updateProfileSchema, req.body)));
});

authRouter.put("/password", requireAuth, async (req, res) => {
  await authService.changePassword(req.user!.email, parseBody(changePasswordSchema, req.body));
  res.json({});
});
