import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 đọc DATABASE_URL qua file này; .env ở root repo nên dotenv mặc định
// (cwd = server/) không thấy. Compose luôn export DATABASE_URL nên đây chỉ là dự phòng.
config({ path: [resolve(import.meta.dirname, "../.env"), resolve(import.meta.dirname, ".env")], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // URL dựng từ DB_* trong compose; chỉ cần tồn tại lúc migrate, generate không kết nối DB.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/food_ordering",
  },
});
