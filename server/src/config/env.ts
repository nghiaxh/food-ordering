import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

// App đọc biến môi trường từ process.env (compose inject) hoặc .env ở root khi chạy local.
// Thiếu biến bắt buộc thì dừng hẳn thay vì chạy lửng rồi trả 500 ở request đầu tiên.
config({ path: [resolve(import.meta.dirname, "../../.env"), resolve(import.meta.dirname, "../.env")], quiet: true });

const schema = z.object({
  // Compose dựng DATABASE_URL từ DB_*; chạy local không có thì tự ghép từ DB_* hoặc fallback mặc định.
  DATABASE_URL: z.string().optional(),
  DB_NAME: z.string().default("food_ordering"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  JWT_SECRET: z.string().min(32, "JWT_SECRET phải có ít nhất 32 ký tự"),
  JWT_EXPIRATION_MS: z.coerce.number().default(86_400_000),
  AI_API_KEY: z.string().default(""),
  AI_PROVIDER: z.string().default("gemini"),
  AI_MODEL: z.string().default("gemini-2.0-flash"),
  UPLOAD_DIR: z.string().default("uploads"),
  PORT: z.coerce.number().default(8080),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Biến môi trường không hợp lệ:\n" + parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
  process.exit(1);
}

const base = parsed.data;

export const env = {
  ...base,
  DATABASE_URL:
    base.DATABASE_URL ??
    `postgresql://${encodeURIComponent(base.DB_USER)}:${encodeURIComponent(base.DB_PASSWORD)}@${base.DB_HOST}:${base.DB_PORT}/${base.DB_NAME}`,
};
