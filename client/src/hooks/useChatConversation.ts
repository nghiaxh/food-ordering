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

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const DEFAULT_TITLE = 'Đoạn chat mới'

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.sender === 'USER')?.content.trim()
  if (!firstUser) return DEFAULT_TITLE
  return firstUser.length > 40 ? `${firstUser.slice(0, 40)}...` : firstUser
}

function createGreetingSession(id?: string): ChatSession {
  const now = Date.now()
  return {
    id: id || crypto.randomUUID(),
    title: DEFAULT_TITLE,
    messages: greetingMessages(),
    createdAt: now,
    updatedAt: now,
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem('chatbot.sessions')
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  // Di chuyển dữ liệu cũ từ key đơn lẻ để không mất hội thoại của khách đã có.
  try {
    const raw = localStorage.getItem('chatbot.messages')
    const legacyId = localStorage.getItem('chatbot.sessionId')
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : null
    if (parsed && parsed.length > 0) {
      const now = Date.now()
      return [
        {
          id: legacyId || crypto.randomUUID(),
          title: deriveTitle(parsed),
          messages: parsed,
          createdAt: now,
          updatedAt: now,
        },
      ]
    }
  } catch {}
  return [createGreetingSession()]
}

function loadActiveId(sessions: ChatSession[]): string {
  try {
    const id = localStorage.getItem('chatbot.activeSessionId')
    if (id && sessions.some((s) => s.id === id)) return id
  } catch {}
  return sessions[0]?.id ?? createGreetingSession().id
}

function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.sender === 'USER')
}

/**
 * Dùng chung cho widget nổi và trang full page: nhiều đoạn chat qua localStorage
 * nên đổi qua lại không mất hội thoại. Widget nổi dùng đoạn đang active.
 */
export function useChatConversation() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions())
  const [activeId, setActiveId] = useState<string>(() => loadActiveId(sessions))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const unavailable = status?.available === false
  const statusNotice = status?.notice ?? CHATBOT_OFF_NOTICE

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0]
  const messages: ChatMessage[] = activeSession?.messages ?? greetingMessages()

  const sessionId = useRef<string>(activeId)
  const lastUserRef = useRef('')
  const lastFoodIdsRef = useRef<number[]>([])
  const activeRef = useRef(true)
  const stoppingRef = useRef(false)

  // sessionId gửi cho server chính là id của đoạn chat đang mở.
  useEffect(() => {
    sessionId.current = activeId
  }, [activeId])

  const setMessages = (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeId) return s
        const next = typeof update === 'function' ? update(s.messages) : update
        // Tiêu đề lấy từ câu hỏi đầu tiên, giữ lại nếu khách đã sửa tay.
        const title = s.title !== DEFAULT_TITLE ? s.title : deriveTitle(next)
        return { ...s, messages: next, updatedAt: Date.now(), title }
      }),
    )
  }

  useEffect(() => {
    try {
      localStorage.setItem('chatbot.sessions', JSON.stringify(sessions))
      localStorage.setItem('chatbot.activeSessionId', activeId)
    } catch {}
  }, [sessions, activeId])

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
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeId) return s
        const next: ChatMessage[] = [
          ...s.messages.map((m) => (m.sender === 'BOT' ? { sender: m.sender, content: m.content } : m)),
          { sender: 'BOT', content, foods, citations, intent },
        ]
        return { ...s, messages: next, updatedAt: Date.now() }
      }),
    )
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
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? { ...s, title: DEFAULT_TITLE, messages: greetingMessages(), updatedAt: Date.now() }
          : s,
      ),
    )
    resetTransientState()
    activeRef.current = true
  }

  const flushDraft = () => {
    if (!draft) return
    const words = draft.content.split(/\s+/)
    const partial = words.slice(0, draft.shownWords).join(' ')
    if (partial.trim()) pushBotMessage(partial, draft.foods || [], draft.citations, draft.intent)
  }

  const switchSession = (id: string) => {
    if (id === activeId) return
    flushDraft()
    const target = sessions.find((s) => s.id === id)
    if (!target) return
    setActiveId(id)
    resetTransientState()
    const lastBot = [...target.messages].reverse().find((m) => m.sender === 'BOT' && m.foods?.length)
    lastFoodIdsRef.current = lastBot?.foods?.map((f) => f.id) ?? []
    activeRef.current = true
  }

  const createSession = () => {
    // Tránh tạo đoạn trống trùng khi đoạn đang mở mới chỉ có lời chào.
    if (!hasUserMessage(messages) && !loading && !draft) {
      resetChat()
      return activeId
    }
    flushDraft()
    const next = createGreetingSession()
    setSessions((prev) => [next, ...prev])
    setActiveId(next.id)
    resetTransientState()
    activeRef.current = true
    return next.id
  }

  const deleteSession = (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id)
    if (remaining.length === 0) {
      const next = createGreetingSession()
      setSessions([next])
      setActiveId(next.id)
      resetTransientState()
      return
    }
    setSessions(remaining)
    if (id === activeId) {
      const sorted = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)
      const nextActive = sorted[0]
      setActiveId(nextActive.id)
      resetTransientState()
      const lastBot = [...nextActive.messages].reverse().find((m) => m.sender === 'BOT' && m.foods?.length)
      lastFoodIdsRef.current = lastBot?.foods?.map((f) => f.id) ?? []
    }
  }

  const submitFeedback = (index: number, rating: 'up' | 'down') => {
    sendChatFeedback(sessionId.current, index, rating).catch(() => {})
  }

  const sessionsSorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return {
    input, setInput, loading, statusText, error, messages, draft, status,
    unavailable, statusNotice, sessionId, activeRef, handleSend, handleRetry,
    resetChat, stopStreaming, submitFeedback, pushBotMessage,
    sessions: sessionsSorted, activeId, activeSession: activeSession ?? null,
    createSession, switchSession, deleteSession,
    isStreaming: draft !== null,
  }
}
