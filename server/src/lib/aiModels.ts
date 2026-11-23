
export const parseList = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))];
};

// Gui thinkingBudget: 0 cho model chat Gemini; model khong nhan se tra 400 va provider bo co.
export const supportsThinking = (model: string): boolean =>
  model.startsWith("gemini-") && !model.includes("-image") && !model.includes("embedding");
