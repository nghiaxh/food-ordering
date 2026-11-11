import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { chat, getChatbotStatus } from '@/user/chatbot/api'
import type { ChatCitation, ChatMessage, ChatbotStatus } from '@/shared/types'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { useUiStore } from '@/shared/stores/uiStore'

export const GREETING_INTRO = 'Chào bạn! Mình là trợ lý đặt món của quán.'
export const GREETING_TASKS =
  'Bạn chưa biết ăn gì? Cứ nhắn mình số người và ngân sách, ví dụ: "Cho 2 người 200k, không cay". Hỏi giờ mở cửa, giao hàng hay cách đặt đơn cũng được.'

/** Bon diem vao dat duoi loi chao; bam la gui tin nhu khach tu go. */
export const GREETING_STARTERS = [
  'Gợi ý món cho 2 người',
  'Món chay không cay',
  'Giờ mở cửa là mấy giờ?',
  'Cách đặt món thế nào?',
]

const CHATBOT_OFF_NOTICE = 'Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.'
const STREAM_TICK_MS = 16
const STREAM_WORDS = 90

interface Draft {
  content: string
  shownWords: number
  foods: ChatMessage['foods']
  citations?: ChatCitation[]
  intent?: string
  quickReplies?: string[]
}
interface LegacySession {
  id: string
  messages: ChatMessage[]
}

const greetingMessages = (): ChatMessage[] => [
  { sender: 'BOT', content: GREETING_INTRO },
  { sender: 'BOT', content: GREETING_TASKS },
]

// Loi chao cu duoc tach 2 bubble; loc bo de hoi thoai cu cua khach dung loi chao moi.
const OLD_GREETING_BUBBLES = new Set([
  'Mình giúp bạn 3 việc:\n1) Gợi ý món theo số người, ngân sách tổng, độ cay, dị ứng.\n2) Hỏi thông tin quán: giờ mở cửa, giao hàng, thanh toán.\n3) Hướng dẫn cách đặt và hủy đơn.\nVí dụ: Cho 2 người 200k, không cay.',
  'Chào bạn! Gợi ý món theo số người, ngân sách, độ cay hay dị ứng thì cứ nhắn. Ví dụ: "Cho 2 người 200k, không cay". Hỏi giờ mở cửa, giao hàng hay cách đặt đơn cũng được.',
])
const KNOWN_GREETING_BUBBLES = new Set([
  GREETING_INTRO,
  GREETING_TASKS,
  ...OLD_GREETING_BUBBLES,
])

const freshGreeting = () => ({ messages: greetingMessages(), sessionId: crypto.randomUUID() })

const withoutStaleGreeting = (messages: ChatMessage[]): ChatMessage[] => {
  const kept = messages.filter((m) => !(m.sender === 'BOT' && OLD_GREETING_BUBBLES.has(m.content)))
  if (kept.every((m) => m.sender === 'BOT' && KNOWN_GREETING_BUBBLES.has(m.content))) {
    return greetingMessages()
  }
  const hasTasks = kept.some((m) => m.sender === 'BOT' && m.content === GREETING_TASKS)
  const hasIntro = kept.some((m) => m.sender === 'BOT' && m.content === GREETING_INTRO)
  // Tu chua hoi thoai tung bi ban migration loc mat bubble mo dau.
  if (hasTasks && !hasIntro) {
    const idx = kept.findIndex((m) => m.sender === 'BOT' && m.content === GREETING_TASKS)
    const healed = [...kept]
    healed.splice(idx, 0, { sender: 'BOT', content: GREETING_INTRO })
    return healed
  }
  return kept
}

const loadSingleSession = () => {
  // Khach cu con hoi thoai multi-session: lay doan dang mo, thieu thi lay doan dau tien.
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
  } catch {
    // storage hong thi bo; dung loi chao moi.
  }
  try {
    const raw = localStorage.getItem('chatbot.sessions')
    const activeId = localStorage.getItem('chatbot.activeSessionId')
    const parsed = raw ? (JSON.parse(raw) as LegacySession[]) : null
    if (parsed && parsed.length > 0) {
      const picked = parsed.find((s) => s.id === activeId) ?? parsed[0]
      if (picked && picked.messages?.length > 0) {
        clearLegacy()
        return { messages: withoutStaleGreeting(picked.messages), sessionId: picked.id || crypto.randomUUID() }
      }
    }
  } catch {
    // storage hong thi bo; dung loi chao moi.
  }
  clearLegacy()
  return freshGreeting()
}

/**
 * Hoi thoai widget noi: mot session duy nhat luu qua localStorage nen mo lai
 * khung chat van giu nguyen ngu canh. Lam moi hoi thoai se cap sessionId moi.
 */
export const useChatConversation = () => {
  const input = ref('')
  const loading = ref(false)
  const statusText = ref<string | null>(null)
  const error = ref(false)
  const initial = loadSingleSession()
  const messages = ref<ChatMessage[]>(initial.messages)
  const sessionId = ref<string>(initial.sessionId)
  const draft = ref<Draft | null>(null)
  const status = ref<ChatbotStatus | null>(null)
  const unavailable = computed(() => status.value?.available === false)
  const statusNotice = computed(() => status.value?.notice ?? CHATBOT_OFF_NOTICE)

  let streamTimer: number | undefined

  // Luu ngu canh vao localStorage moi khi hoi thoai hoac session doi.
  watch([messages, sessionId], () => {
    try {
      localStorage.setItem('chatbot.messages', JSON.stringify(messages.value))
      localStorage.setItem('chatbot.sessionId', sessionId.value)
    } catch {
      // quota day hoac storage bi chan: bo qua, hoi thoai van chay trong phien.
    }
  }, { deep: true })

  onMounted(async () => {
    try {
      status.value = await getChatbotStatus()
    } catch {
      status.value = null
    }
  })

  const pushBotMessage = (content: string, foods: ChatMessage['foods'] = [], citations?: ChatCitation[], intent?: string, quickReplies?: string[]) => {
    // Chi tin bot moi nhat con the va nut hanh dong; tin cu giu noi dung chu.
    messages.value = [
      ...messages.value.map((m) => (m.sender === 'BOT' ? { sender: 'BOT' as const, content: m.content } : m)),
      { sender: 'BOT', content, foods, citations, intent, quickReplies },
    ]
  }

  const flushDraft = (d: Draft) => {
    const partial = d.shownWords > 0 ? d.content.split(/\s+/).slice(0, d.shownWords).join(' ') : ''
    const content = partial.trim() ? partial : d.content
    pushBotMessage(content, d.foods || [], d.citations, d.intent, d.quickReplies)
  }

  // "Dang go" tung tu: moi tick tang so tu da hien; panel dong thi hien thang, khong chay hieu ung.
  watch(draft, (d) => {
    if (streamTimer) window.clearInterval(streamTimer)
    if (!d) return
    streamTimer = window.setInterval(() => {
      const current = draft.value
      if (!current) {
        if (streamTimer) window.clearInterval(streamTimer)
        streamTimer = undefined
        return
      }
      const words = current.content.split(/\s+/)
      if (current.shownWords >= words.length) {
        window.clearInterval(streamTimer)
        streamTimer = undefined
        flushDraft(current)
        draft.value = null
        return
      }
      const step = Math.max(1, Math.ceil(words.length / STREAM_WORDS))
      current.shownWords = Math.min(words.length, current.shownWords + step)
    }, STREAM_TICK_MS)
  })
  onBeforeUnmount(() => {
    if (streamTimer) window.clearInterval(streamTimer)
  })

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input.value).trim()
    if (!text || loading.value || unavailable.value) return
    if (draft.value) {
      flushDraft(draft.value)
      draft.value = null
    }
    input.value = ''
    const history = messages.value.filter((m) => m.sender === 'USER').map((m) => m.content).slice(-3)
    const lastFoodIds = messages.value.length
      ? ([...messages.value].reverse().find((m) => m.sender === 'BOT') as ChatMessage | undefined)?.foods?.map((f) => f.id) ?? []
      : []
    messages.value = [...messages.value, { sender: 'USER', content: text }]
    loading.value = true
    // Status text cho nguoi moi biet bot dang lam gi.
    const p = text.toLowerCase()
    const isInfo = ['giờ', 'địa chỉ', 'giao hàng', 'ship', 'thanh toán', 'mở cửa', 'đóng cửa'].some((k) => p.includes(k))
    statusText.value = isInfo ? 'Đang tra tài liệu quán...' : 'Đang tìm món...'

    try {
      const res = await chat(text, sessionId.value, history, lastFoodIds)
      error.value = false
      const foods = (res.foods || []).slice(0, 5)
      const citations = res.citations || undefined
      const intent = res.intent || undefined
      const quickReplies = res.quickReplies || undefined
      // Panel dong giua chung thi ghi thang tin nhan, khong chay animated reveal vo hinh.
      const ui = useUiStore()
      const canStream = ui.chatOpen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (canStream) {
        draft.value = { content: res.reply, shownWords: 0, foods, citations, intent, quickReplies }
      } else {
        pushBotMessage(res.reply, foods, citations, intent, quickReplies)
      }
    } catch (e) {
      const httpStatus = (e as { response?: { status?: number } }).response?.status
      if (httpStatus === 503) {
        status.value = { available: false, notice: apiErrorMessage(e) ?? CHATBOT_OFF_NOTICE }
        error.value = false
        return
      }
      error.value = true
      pushBotMessage('Mình chưa gửi được câu hỏi, bạn thử lại nhé!', [])
    } finally {
      // Panel dong giua chung cung phai mo lai o nhap; dung de loading ket vinh vien.
      loading.value = false
      statusText.value = null
    }
  }

  const stopStreaming = () => {
    if (!draft.value) return
    const d = draft.value
    if (streamTimer) {
      window.clearInterval(streamTimer)
      streamTimer = undefined
    }
    flushDraft(d)
    draft.value = null
  }

  const handleRetry = () => {
    // Thu lai cau gan nhat cua khach.
    const lastUser = [...messages.value].reverse().find((m) => m.sender === 'USER')
    if (!lastUser) return
    error.value = false
    void handleSend(lastUser.content)
  }

  const resetChat = () => {
    messages.value = greetingMessages()
    sessionId.value = crypto.randomUUID()
    if (streamTimer) {
      window.clearInterval(streamTimer)
      streamTimer = undefined
    }
    draft.value = null
    input.value = ''
    error.value = false
    loading.value = false
    statusText.value = null
  }

  return {
    input,
    setInput: (v: string) => { input.value = v },
    loading: loading as Readonly<Ref<boolean>>,
    statusText: statusText as Readonly<Ref<string | null>>,
    error: error as Readonly<Ref<boolean>>,
    messages,
    draft,
    status,
    unavailable,
    statusNotice,
    sessionId,
    handleSend,
    handleRetry,
    resetChat,
    stopStreaming,
    isStreaming: computed(() => draft.value !== null),
  }
}
