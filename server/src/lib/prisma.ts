import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

// Prisma 7 bắt buộc driver adapter; @prisma/adapter-pg bọc pg nên dùng lại connection string quen thuộc.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

/** DECIMAL trong DB đọc ra thành Decimal object; client nhận VND nguyên nên ép về number. */
export const toNumber = (v: unknown): number => Number(v);
