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

/** DECIMAL trong DB doc ra string/number; client nhan VND nguyen nen ep ve number. */
export const toNumber = (v: unknown): number => Number(v);
