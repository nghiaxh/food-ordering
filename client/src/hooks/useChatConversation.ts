import { useEffect, useRef, useState } from 'react'
import { chat, getChatbotStatus, sendChatFeedback } from '../api/api'
import type { ChatCitation, ChatMessage, ChatbotStatus } from '../types'
import { apiErrorMessage } from '../utils/api-error'

export const GREETING_INTRO = 'Chào bạn! Mình là trợ lý đặt món của quán.'

export const GREETING_TASKS =
  'Mình giúp bạn 3 việc:\n'
  + '1) Gợi ý món theo số người, ngân sách tổng, độ cay, dị ứng.\n'
  + '2) Hỏi thông tin quán: giờ mở cửa, giao hàng, thanh toán.\n'
  + '3) Hướng dẫn cách đặt và hủy đơn.\n'
  + 'Ví dụ: Cho 2 người 200k, không cay.'

export const GREETING = `${GREETING_INTRO} ${GREETING_TASKS}`

function greetingMessages(): ChatMessage[] {
  // Tách lời chào thành 2 bubble: dòng chào ngắn và dòng việc dài để không dồn thành một khối.
  return [
    { sender: 'BOT', content: GREETING_INTRO },
    { sender: 'BOT', content: GREETING_TASKS },
  ]
}

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

type LegacySession = {
  id: string
  messages: ChatMessage[]
}

function loadSingleSession(): { messages: ChatMessage[], sessionId: string } {
  try {
    const raw = localStorage.getItem('chatbot.messages')
    const legacyId = localStorage.getItem('chatbot.sessionId')
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : null
    if (parsed && parsed.length > 0) {
      return { messages: parsed, sessionId: legacyId || crypto.randomUUID() }
    }
  } catch {}
  // Khách cũ còn hội thoại multi-session: lấy đoạn đang mở, thiếu thì lấy đoạn đầu tiên.
  try {
    const raw = localStorage.getItem('chatbot.sessions')
    const activeId = localStorage.getItem('chatbot.activeSessionId')
    const parsed = raw ? (JSON.parse(raw) as LegacySession[]) : null
    if (parsed && parsed.length > 0) {
      const picked = parsed.find((s) => s.id === activeId) ?? parsed[0]
      if (picked && picked.messages && picked.messages.length > 0) {
        localStorage.removeItem('chatbot.sessions')
        localStorage.removeItem('chatbot.activeSessionId')
        return { messages: picked.messages, sessionId: picked.id || crypto.randomUUID() }
      }
    }
  } catch {}
  localStorage.removeItem('chatbot.sessions')
  localStorage.removeItem('chatbot.activeSessionId')
  return { messages: greetingMessages(), sessionId: crypto.randomUUID() }
}

/**
 * Hội thoại widget nổi: một session duy nhất lưu qua localStorage nên mở lại
 * khung chat vẫn giữ nguyên ngữ cảnh. Làm mới hội thoại sẽ cấp sessionId mới.
 */
export function useChatConversation() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [initial] = useState(() => loadSingleSession())
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages)
  const [sessionId, setSessionId] = useState<string>(initial.sessionId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const unavailable = status?.available === false
  const statusNotice = status?.notice ?? CHATBOT_OFF_NOTICE

  const sessionIdRef = useRef<string>(sessionId)
  const lastUserRef = useRef('')
  const lastFoodIdsRef = useRef<number[]>([])
  const activeRef = useRef(true)
  const stoppingRef = useRef(false)

  const updateMessages = (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages((prev) => (typeof update === 'function' ? update(prev) : update))
  }

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    try {
      localStorage.setItem('chatbot.messages', JSON.stringify(messages))
      localStorage.setItem('chatbot.sessionId', sessionId)
    } catch {}
  }, [messages, sessionId])

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
    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev.map((m) => (m.sender === 'BOT' ? { sender: m.sender, content: m.content } : m)),
        { sender: 'BOT', content, foods, citations, intent },
      ]
      return next
    })
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
    updateMessages(newMessages)
    setLoading(true)
    // Status text cho người mới biết bot đang làm gì.
    const plain = text.toLowerCase()
    const isInfo = plain.includes('giờ') || plain.includes('địa chỉ') || plain.includes('giao hàng') || plain.includes('ship') || plain.includes('thanh toán') || plain.includes('mở cửa') || plain.includes('đóng cửa')
    setStatusText(isInfo ? 'Đang tra tài liệu quán...' : 'Đang tìm món...')
    try {
      const res = await chat(text, sessionIdRef.current, history, lastFoodIdsRef.current)
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

  const resetTransientState = () => {
    setDraft(null)
    setInput('')
    setError(false)
    setLoading(false)
    setStatusText(null)
    lastUserRef.current = ''
    lastFoodIdsRef.current = []
  }

  const resetChat = () => {
    setMessages(greetingMessages())
    setSessionId(crypto.randomUUID())
    resetTransientState()
    activeRef.current = true
  }

  const submitFeedback = (index: number, rating: 'up' | 'down') => {
    sendChatFeedback(sessionIdRef.current, index, rating).catch(() => {})
  }

  return {
    input, setInput, loading, statusText, error, messages, draft, status,
    unavailable, statusNotice, sessionId, activeRef, handleSend, handleRetry,
    resetChat, stopStreaming, submitFeedback, pushBotMessage,
    isStreaming: draft !== null,
  }
}
