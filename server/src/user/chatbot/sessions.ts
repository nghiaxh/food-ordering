import type { ChatMessagePayload } from "../../db/schema.js";

/** Mot phien trong danh sach lich su; tieu de lay tu cau hoi dau tien cua khach. */
export interface ChatSessionSummary {
  sessionId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

/** Tin nhan tra ve client khi mo lai phien; payload chi co o tin BOT. */
export interface ChatHistoryEntry {
  id: number;
  sender: "USER" | "BOT";
  content: string;
  foods: ChatMessagePayload["foods"] | null;
  intent: string | null;
  citations: ChatMessagePayload["citations"];
  quickReplies: string[] | null;
  createdAt: string;
}

const TITLE_MAX = 60;

/** Cat tieu de de danh sach phien khong vo layout; phien chi co loi chao co tieu de mac dinh. */
export const sessionTitle = (content: string | null | undefined): string => {
  const text = (content ?? "").replaceAll(/\s+/g, " ").trim();
  if (!text) return "Hội thoại mới";
  return text.length <= TITLE_MAX ? text : `${text.slice(0, TITLE_MAX).trim()}...`;
};
