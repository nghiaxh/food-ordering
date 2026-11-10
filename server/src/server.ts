import { mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

mkdirSync(env.UPLOAD_DIR, { recursive: true });

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`FoodOrdering server đang lắng nghe tại http://localhost:${env.PORT}/api`);
});
