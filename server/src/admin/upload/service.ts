import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { asc, count, desc, eq } from "drizzle-orm";
import {
  aiSetting,
  cartItems,
  chatMessages,
  notifications,
  orders,
  promotions,
  reviews,
  userAddresses,
  users,
} from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { toUserJson } from "../../lib/serializers.js";
import { env } from "../../config/env.js";


// ----- Anh mon an -----

/** Tra ve phan mo rong neu 12 byte dau khop chu ky JPEG, PNG hoac WEBP. */
const imageExtension = (head: Buffer): string | null => {
  if (head[0] === 0xff && head[1] === 0xd8) return ".jpg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return ".png";
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return ".webp";
  }
  return null;
};

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Tai anh mon an: kiem chu ky dau file (JPG/PNG/WEBP), luu vao UPLOAD_DIR.
export const saveImage = async (buffer: Buffer, host: string, protocol: string) => {
  const ext = imageExtension(buffer.subarray(0, 12));
  if (!ext) throw badRequest("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
  const name = `${randomUUID()}${ext}`;
  writeFileSync(join(env.UPLOAD_DIR, name), buffer);
  return { url: `${protocol}://${host}/api/uploads/${name}`, mime: IMAGE_MIME[ext] };
};