import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "../db/schema.js";
import * as relations from "../db/relations.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});

export type Database = typeof db;

/** DECIMAL trong DB đọc ra string/number; client nhận VND nguyên nên ép về number. */
export const toNumber = (v: unknown): number => Number(v);
