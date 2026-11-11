import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./user/auth/routes.js";
import { menuRouter } from "./user/menu/routes.js";
import { reviewRouter } from "./user/review/routes.js";
import { cartRouter } from "./user/cart/routes.js";
import { orderRouter } from "./user/order/routes.js";
import { notificationRouter } from "./user/notification/routes.js";
import { userRouter } from "./user/user/routes.js";
import { chatbotRouter } from "./user/chatbot/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Anh admin tai len phuc vu cong khai cho moi khach xem thuc don nen phai cho cross-origin <img>.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  // API dong khong duoc cache: tranh 304 voi body rong o cac client sau revalidation.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api/uploads", express.static(env.UPLOAD_DIR));

  app.use("/api/auth", authRouter);
  app.use("/api", menuRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api", userRouter);
  app.use("/api/chatbot", chatbotRouter);
  app.use("/api/admin", adminRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Không tìm thấy API được yêu cầu." });
  });

  app.use(errorHandler);
  return app;
}
