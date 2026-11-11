import { z } from "zod";

export const addressRequestSchema = z.object({
  label: z.string().max(50, "Nh├ún ─æß╗ïa chß╗ë tß╗æi ─æa 50 k├╜ tß╗▒").optional(),
  receiverName: z.string().min(1, "Nhß║¡p t├¬n ng╞░ß╗¥i nhß║¡n"),
  phone: z.string().regex(/^0\d{9}$/, "Sß╗æ ─æiß╗çn thoß║íi phß║úi gß╗ôm ─æ├║ng 10 chß╗» sß╗æ"),
  address: z.string().min(1, "Nhß║¡p ─æß╗ïa chß╗ë giao h├áng"),
  isDefault: z.boolean().optional(),
});
