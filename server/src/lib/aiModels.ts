// Helper thuan cho cau hinh model, tach khoi provider de test khong phai nap env.

/** Tach danh sach phan tach dau phay/xuong dong; mot gia tri van thanh mang mot phan tu. */
export const parseList = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))];
};

// Model chat Gemini 3.x mac dinh bat thinking, nen gui `thinkingBudget: 0` de bot tra loi nhanh.
// Model khong ho tro se tra 400; provider thu lai khong thinking va ghi nho theo tung model,
// vi vay o day khong doan theo ten (lite van co model nhan, co model khong).
export const supportsThinking = (model: string): boolean =>
  model.startsWith("gemini-") && !model.includes("-image") && !model.includes("embedding");
