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
 * Gửi câu hỏi kèm 3 câu trước và ID các món vừa gợi ý để server hiểu câu hỏi tiếp; server
 * không lưu ngữ cảnh này vào CSDL nên khách vãng lai vẫn dùng được.
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
