import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { menuRouter } from "./modules/menu/routes.js";
import { reviewRouter } from "./modules/review/routes.js";
import { cartRouter } from "./modules/cart/routes.js";
import { orderRouter } from "./modules/order/routes.js";
import { notificationRouter } from "./modules/notification/routes.js";
import { userRouter } from "./modules/user/routes.js";
import { chatbotRouter } from "./modules/chatbot/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Ảnh admin tải lên phục vụ công khai cho mọi khách xem thực đơn nên phải cho cross-origin <img>.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  // Ảnh upload phục vụ qua /api/uploads/**; thư mục mount volume khi chạy compose.
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
