import { useEffect, useRef, useState } from 'react'
import { chat, getChatbotStatus, sendChatFeedback } from '../api/api'
import type { ChatCitation, ChatMessage, ChatbotStatus } from '../types'
import { apiErrorMessage } from '../utils/api-error'

export const GREETING =
  'Chào bạn! Mình là trợ lý đặt món của quán. Mình giúp bạn 3 việc:\n'
  + '1) Gợi ý món theo số người, ngân sách tổng, độ cay, dị ứng.\n'
  + '2) Hỏi thông tin quán: giờ mở cửa, giao hàng, thanh toán.\n'
  + '3) Hướng dẫn cách đặt và hủy đơn.\n'
  + 'Ví dụ: Cho 2 người 200k, không cay.'

const SUGGESTION_GROUPS: Record<string, string[]> = {
  'Gợi ý món': [
    'Cho 2 người 150k không cay',
    'Món chay không cay',
    'Món nào không chứa hải sản?',
    '1 món chính và 1 món uống khoảng 150k',
  ],
  'Thông tin quán': [
    'Giờ mở cửa là mấy giờ?',
    'Phí ship và thời gian giao?',
    'Thanh toán thế nào?',
  ],
  'Đặt hàng': [
    'Cách đặt món thế nào?',
    'Đơn hàng bị hủy thì sao?',
    'Xem trạng thái đơn ở đâu?',
  ],
}

export const SUGGESTIONS = Object.values(SUGGESTION_GROUPS).flat()
export const SUGGESTION_GROUPS_LIST = SUGGESTION_GROUPS

const CHATBOT_OFF_NOTICE = 'Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.'
const STREAM_TICK_MS = 16
const STREAM_WORDS = 90

type Draft = {
  content: string
  shownWords: number
  foods: ChatMessage['foods']
  citations?: ChatCitation[]
  intent?: string
}

/**
 * Dùng chung cho widget nổi và trang full page: chung sessionId + messages qua localStorage
 * nên đổi qua lại không mất hội thoại.
 */
export function useChatConversation() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem('chatbot.messages')
      const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : null
      if (parsed && parsed.length > 0) return parsed
    } catch {}
    return [{ sender: 'BOT', content: GREETING }]
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const unavailable = status?.available === false
  const statusNotice = status?.notice ?? CHATBOT_OFF_NOTICE

  const sessionId = useRef<string>(localStorage.getItem('chatbot.sessionId') || crypto.randomUUID())
  const lastUserRef = useRef('')
  const lastFoodIdsRef = useRef<number[]>([])
  const activeRef = useRef(true)
  const stoppingRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem('chatbot.sessionId', sessionId.current)
    } catch {}
  }, [])
  useEffect(() => {
    try {
      // Chỉ lưu khi có hội thoại thật, tránh ghi đè greeting khi vừa reset.
      localStorage.setItem('chatbot.messages', JSON.stringify(messages))
    } catch {}
  }, [messages])

  useEffect(() => {
    getChatbotStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    if (!draft) return
    const words = draft.content.split(/\s+/)
    if (draft.shownWords >= words.length) {
      if (stoppingRef.current) {
        // Người dùng bấm Dừng thì chỉ đẩy những từ đã hiện.
        const partial = words.slice(0, draft.shownWords).join(' ')
        if (partial.trim()) pushBotMessage(partial, draft.foods || [], draft.citations, draft.intent)
      } else {
        pushBotMessage(draft.content, draft.foods || [], draft.citations, draft.intent)
      }
      stoppingRef.current = false
      setDraft(null)
      return
    }
    const step = Math.max(1, Math.ceil(words.length / STREAM_WORDS))
    const timer = window.setTimeout(() => {
      setDraft((d) => (d ? { ...d, shownWords: Math.min(words.length, d.shownWords + step) } : d))
    }, STREAM_TICK_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const pushBotMessage = (content: string, foods: ChatMessage['foods'] = [], citations?: ChatCitation[], intent?: string) => {
    setMessages((current) => [
      ...current.map((m) => (m.sender === 'BOT' ? { sender: m.sender, content: m.content } : m)),
      { sender: 'BOT', content, foods, citations, intent },
    ])
  }

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || loading || unavailable) return
    if (draft) {
      const words = draft.content.split(/\s+/)
      pushBotMessage(words.slice(0, draft.shownWords).join(' ') || draft.content, draft.foods || [], draft.citations, draft.intent)
      setDraft(null)
    }
    stoppingRef.current = false
    setInput('')
    lastUserRef.current = text
    const history = messages.filter((m) => m.sender === 'USER').map((m) => m.content).slice(-3)
    const newMessages: ChatMessage[] = [...messages, { sender: 'USER', content: text }]
    setMessages(newMessages)
    setLoading(true)
    // Status text cho người mới biết bot đang làm gì.
    const plain = text.toLowerCase()
    const isInfo = plain.includes('giờ') || plain.includes('địa chỉ') || plain.includes('giao hàng') || plain.includes('ship') || plain.includes('thanh toán') || plain.includes('mở cửa') || plain.includes('đóng cửa')
    setStatusText(isInfo ? 'Đang tra tài liệu quán...' : 'Đang tìm món...')
    try {
      const res = await chat(text, sessionId.current, history, lastFoodIdsRef.current)
      if (!activeRef.current) return
      setError(false)
      const foods = (res.foods || []).slice(0, 5)
      lastFoodIdsRef.current = foods.map((f) => f.id)
      const citations = res.citations || undefined
      const intent = res.intent || undefined
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pushBotMessage(res.reply, foods, citations, intent)
      } else {
        setDraft({ content: res.reply, shownWords: 0, foods, citations, intent })
      }
    } catch (e) {
      if (!activeRef.current) return
      if ((e as { response?: { status?: number } }).response?.status === 503) {
        setStatus({ available: false, notice: apiErrorMessage(e) ?? CHATBOT_OFF_NOTICE })
        setError(false)
        lastFoodIdsRef.current = []
        return
      }
      setError(true)
      lastFoodIdsRef.current = []
      pushBotMessage('Mình chưa gửi được câu hỏi, bạn thử lại nhé!', [])
    } finally {
      if (activeRef.current) {
        setLoading(false)
        setStatusText(null)
      }
    }
  }

  const stopStreaming = () => {
    if (!draft) return
    stoppingRef.current = true
    const words = draft.content.split(/\s+/)
    const partial = words.slice(0, draft.shownWords).join(' ')
    if (partial.trim()) pushBotMessage(partial, draft.foods || [], draft.citations, draft.intent)
    setDraft(null)
  }

  const handleRetry = () => {
    if (!lastUserRef.current) return
    setError(false)
    void handleSend(lastUserRef.current)
  }

  const resetChat = () => {
    setMessages([{ sender: 'BOT', content: GREETING }])
    setDraft(null)
    setInput('')
    setError(false)
    setLoading(false)
    setStatusText(null)
    sessionId.current = crypto.randomUUID()
    try {
      localStorage.setItem('chatbot.sessionId', sessionId.current)
      localStorage.setItem('chatbot.messages', JSON.stringify([{ sender: 'BOT', content: GREETING }]))
    } catch {}
    lastUserRef.current = ''
    lastFoodIdsRef.current = []
    activeRef.current = true
  }

  const submitFeedback = (index: number, rating: 'up' | 'down') => {
    sendChatFeedback(sessionId.current, index, rating).catch(() => {})
  }

  return {
    input, setInput, loading, statusText, error, messages, draft, status,
    unavailable, statusNotice, sessionId, activeRef, handleSend, handleRetry,
    resetChat, stopStreaming, submitFeedback, pushBotMessage,
    isStreaming: draft !== null,
  }
}
