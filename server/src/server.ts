import { mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startOrderExpirySweeper } from "./user/order/expiryJob.js";

mkdirSync(env.UPLOAD_DIR, { recursive: true });

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`Server is listening on http://localhost:${env.PORT}/api`);
});

startOrderExpirySweeper();
