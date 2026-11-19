// Helper thuan cho cau hinh model, tach khoi provider de test khong phai nap env.

/** Tach danh sach phan tach dau phay/xuong dong; mot gia tri van thanh mang mot phan tu. */
export const parseList = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))];
};

// Gemini flash ban day du nhan thinkingConfig; ban lite va image thi khong.
export const supportsThinking = (model: string): boolean =>
  /gemini-\d+(?:\.\d+)?-flash(?:$|-)/.test(model) && !model.includes("-lite") && !model.includes("-image");
