import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { menuAdminRouter } from "./menu/routes.js";
import { orderAdminRouter } from "./order/routes.js";
import { customerAdminRouter } from "./customer/routes.js";
import { promotionAdminRouter } from "./promotion/routes.js";
import { chatbotAdminRouter } from "./chatbot/routes.js";
import { paymentAdminRouter } from "./payment/routes.js";
import { reportAdminRouter } from "./report/routes.js";
import { uploadAdminRouter } from "./upload/routes.js";

export const adminRouter = Router();

// Toan bo khu vuc quan tri yeu cau role ADMIN; route guard phia client chi la UX.
adminRouter.use(requireRole("ADMIN"));

adminRouter.use(menuAdminRouter);
adminRouter.use(orderAdminRouter);
adminRouter.use(customerAdminRouter);
adminRouter.use(promotionAdminRouter);
adminRouter.use(chatbotAdminRouter);
adminRouter.use(paymentAdminRouter);
adminRouter.use(reportAdminRouter);
adminRouter.use(uploadAdminRouter);
