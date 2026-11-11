import http from '@/shared/api/http'
import type { ChatCitation, FoodCard } from '@/shared/types'

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
