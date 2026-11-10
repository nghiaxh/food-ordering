import { useEffect, useRef, useState } from 'react'
import { chat, getChatbotStatus } from '../api/api'
import type { ChatCitation, ChatMessage, ChatbotStatus } from '../types'
import { apiErrorMessage } from '../utils/api-error'
import { useUiStore } from '../store/uiStore'

export const GREETING_INTRO = 'Chào bạn! Mình là trợ lý đặt món của quán.'

export const GREETING_TASKS =
  'Bạn chưa biết ăn gì? Cứ nhắn mình số người và ngân sách, ví dụ: "Cho 2 người 200k, không cay". Hỏi giờ mở cửa, giao hàng hay cách đặt đơn cũng được.'

/** Bốn điểm vào đặt dưới lời chào; bấm là gửi tin như khách tự gõ. */
export const GREETING_STARTERS = [
  'Gợi ý món cho 2 người',
  'Món chay không cay',
  'Giờ mở cửa là mấy giờ?',
  'Cách đặt món thế nào?',
]

function greetingMessages(): ChatMessage[] {
  return [
    { sender: 'BOT', content: GREETING_INTRO },
    { sender: 'BOT', content: GREETING_TASKS },
  ]
}

const CHATBOT_OFF_NOTICE = 'Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.'
const STREAM_TICK_MS = 16
const STREAM_WORDS = 90

type Draft = {
  content: string
  shownWords: number
  foods: ChatMessage['foods']
  citations?: ChatCitation[]
  intent?: string
  quickReplies?: string[]
}

type LegacySession = {
  id: string
  messages: ChatMessage[]
}

// Lời chào cũ được tách 2 bubble; lọc bỏ để hội thoại cũ của khách dùng lời chào mới.
// (Bubble mở đầu mới dùng lại đúng câu cũ nên không lọc riêng — chỉ lọc các phần bị thay đổi.)
const OLD_GREETING_BUBBLES = new Set([
  'Mình giúp bạn 3 việc:\n'
    + '1) Gợi ý món theo số người, ngân sách tổng, độ cay, dị ứng.\n'
    + '2) Hỏi thông tin quán: giờ mở cửa, giao hàng, thanh toán.\n'
    + '3) Hướng dẫn cách đặt và hủy đơn.\n'
    + 'Ví dụ: Cho 2 người 200k, không cay.',
  // Bản lời chào 1 bubble từng lưu ở phiên bản trước cũng phải dọn.
  'Chào bạn! Gợi ý món theo số người, ngân sách, độ cay hay dị ứng thì cứ nhắn. Ví dụ: "Cho 2 người 200k, không cay". Hỏi giờ mở cửa, giao hàng hay cách đặt đơn cũng được.',
])

// Mọi bubble từng là lời chào (cũ hoặc mới): hội thoại chỉ toàn chào thì trả lời chào mới đủ hai bubble.
const KNOWN_GREETING_BUBBLES = new Set([
  'Chào bạn! Mình là trợ lý đặt món của quán.',
  GREETING_TASKS,
  ...OLD_GREETING_BUBBLES,
])

function freshGreeting(): { messages: ChatMessage[], sessionId: string } {
  return { messages: greetingMessages(), sessionId: crypto.randomUUID() }
}

function withoutStaleGreeting(messages: ChatMessage[]): ChatMessage[] {
  const kept = messages.filter((m) => !(m.sender === 'BOT' && OLD_GREETING_BUBBLES.has(m.content)))
  if (kept.every((m) => m.sender === 'BOT' && KNOWN_GREETING_BUBBLES.has(m.content))) {
    return greetingMessages()
  }
  // Tự chữa hội thoại từng bị bản migration lọc mất bubble mở đầu: chèn lại ngay trước TASKS.
  const hasTasks = kept.some((m) => m.sender === 'BOT' && m.content === GREETING_TASKS)
  const hasIntro = kept.some((m) => m.sender === 'BOT' && m.content === GREETING_INTRO)
  if (hasTasks && !hasIntro) {
    const idx = kept.findIndex((m) => m.sender === 'BOT' && m.content === GREETING_TASKS)
    const healed = [...kept]
    healed.splice(idx, 0, { sender: 'BOT', content: GREETING_INTRO })
    return healed
  }
  return kept
}

function loadSingleSession(): { messages: ChatMessage[], sessionId: string } {
  // Khách cũ còn hội thoại multi-session: lấy đoạn đang mở, thiếu thì lấy đoạn đầu tiên.
  const clearLegacy = () => {
    localStorage.removeItem('chatbot.sessions')
    localStorage.removeItem('chatbot.activeSessionId')
  }
  try {
    const raw = localStorage.getItem('chatbot.messages')
    const legacyId = localStorage.getItem('chatbot.sessionId')
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : null
    if (parsed && parsed.length > 0) {
      clearLegacy()
      return { messages: withoutStaleGreeting(parsed), sessionId: legacyId || crypto.randomUUID() }
    }
  } catch {}
  try {
    const raw = localStorage.getItem('chatbot.sessions')
    const activeId = localStorage.getItem('chatbot.activeSessionId')
    const parsed = raw ? (JSON.parse(raw) as LegacySession[]) : null
    if (parsed && parsed.length > 0) {
      const picked = parsed.find((s) => s.id === activeId) ?? parsed[0]
      if (picked && picked.messages && picked.messages.length > 0) {
        clearLegacy()
        return { messages: withoutStaleGreeting(picked.messages), sessionId: picked.id || crypto.randomUUID() }
      }
    }
  } catch {}
  clearLegacy()
  return freshGreeting()
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
        if (partial.trim()) pushBotMessage(partial, draft.foods || [], draft.citations, draft.intent, draft.quickReplies)
      } else {
        pushBotMessage(draft.content, draft.foods || [], draft.citations, draft.intent, draft.quickReplies)
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

  const pushBotMessage = (content: string, foods: ChatMessage['foods'] = [], citations?: ChatCitation[], intent?: string, quickReplies?: string[]) => {
    setMessages((prev) => {
      const next: ChatMessage[] = [
        // Chỉ tin bot mới nhất còn thẻ và nút hành động; tin cũ giữ nội dung chữ.
        ...prev.map((m) => (m.sender === 'BOT' ? { sender: m.sender, content: m.content } : m)),
        { sender: 'BOT', content, foods, citations, intent, quickReplies },
      ]
      return next
    })
  }

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || loading || unavailable) return
    if (draft) {
      const words = draft.content.split(/\s+/)
      pushBotMessage(words.slice(0, draft.shownWords).join(' ') || draft.content, draft.foods || [], draft.citations, draft.intent, draft.quickReplies)
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
      setError(false)
      const foods = (res.foods || []).slice(0, 5)
      lastFoodIdsRef.current = foods.map((f) => f.id)
      const citations = res.citations || undefined
      const intent = res.intent || undefined
      const quickReplies = res.quickReplies || undefined
      // Panel đóng giữa chừng thì ghi thẳng tin nhắn, không chạy animated reveal vô hình.
      const canStream = useUiStore.getState().chatOpen
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (canStream) {
        setDraft({ content: res.reply, shownWords: 0, foods, citations, intent, quickReplies })
      } else {
        pushBotMessage(res.reply, foods, citations, intent, quickReplies)
      }
    } catch (e) {
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
      // Panel đóng giữa chừng cũng phải mở lại ô nhập; đừng để loading kẹt vĩnh viễn.
      setLoading(false)
      setStatusText(null)
    }
  }

  const stopStreaming = () => {
    if (!draft) return
    stoppingRef.current = true
    const words = draft.content.split(/\s+/)
    const partial = words.slice(0, draft.shownWords).join(' ')
    if (partial.trim()) pushBotMessage(partial, draft.foods || [], draft.citations, draft.intent, draft.quickReplies)
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
  }

  return {
    input, setInput, loading, statusText, error, messages, draft, status,
    unavailable, statusNotice, sessionId, handleSend, handleRetry,
    resetChat, stopStreaming, isStreaming: draft !== null,
  }
}
