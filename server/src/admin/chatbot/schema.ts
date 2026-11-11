import { z } from "zod";

export const documentRequestSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  category: z.string().max(100).nullish(),
  keywords: z.string().max(500).nullish(),
  content: z.string().min(1, "Nội dung không được để trống"),
  enabled: z.boolean(),
});

export const settingSaveSchema = z.object({
  settingKey: z.string().min(1),
  settingValue: z.string().min(1),
});