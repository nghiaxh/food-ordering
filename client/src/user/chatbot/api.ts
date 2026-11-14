import http from '@/shared/api/http'
import type { ChatCitation, ChatHistoryEntry, ChatSessionSummary, FoodCard } from '@/shared/types'

export interface ChatResponse {
  reply: string
  foods: FoodCard[]
  intent?: string
  citations?: ChatCitation[]
  quickReplies?: string[]
}

/**
 * Gui cau hoi kem 3 cau truoc va ID cac mon vua goi y de server hieu cau hoi tiep; server
 * khong luu ngu canh nay vao CSDL nen khach vang lai van dung duoc.
 */
export const chat = (
  message: string,
  sessionId: string,
  history: string[] = [],
  lastFoodIds: number[] = [],
) =>
  http
    .post<ChatResponse>('/chatbot/chat', { message, sessionId, history, lastFoodIds })
    .then((r) => r.data)

export const getChatbotStatus = (signal?: AbortSignal) =>
  http.get<{ available: boolean; notice: string | null }>('/chatbot/status', { signal }).then((r) => r.data)

/** Lich su chi co khi da dang nhap; server loc theo tai khoan trong token. */
export const listChatSessions = () =>
  http.get<ChatSessionSummary[]>('/chatbot/sessions').then((r) => r.data)

export const getChatSession = (sessionId: string) =>
  http
    .get<{ sessionId: string; messages: ChatHistoryEntry[] }>(`/chatbot/sessions/${encodeURIComponent(sessionId)}`)
    .then((r) => r.data)

export const deleteChatSession = (sessionId: string) =>
  http.delete(`/chatbot/sessions/${encodeURIComponent(sessionId)}`)
