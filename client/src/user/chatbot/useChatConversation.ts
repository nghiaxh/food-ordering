import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { chat, deleteChatSession, getChatbotStatus, getChatSession, listChatSessions } from '@/user/chatbot/api'
import type { ChatCitation, ChatHistoryEntry, ChatMessage, ChatSessionSummary, ChatbotStatus } from '@/shared/types'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { useAuthStore } from '@/user/auth/store'

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

const CHAT_CACHE_KEY = 'chatbot.state'
// Key cua ban cu: khong ghi chu so huu nen chi doc duoc khi dang la khach vang lai.
const LEGACY_CACHE_KEYS = ['chatbot.messages', 'chatbot.sessionId', 'chatbot.sessions', 'chatbot.activeSessionId']

interface ChatCache {
  ownerId: number | null
  sessionId: string
  messages: ChatMessage[]
}

const isChatCache = (value: unknown): value is ChatCache => {
  if (typeof value !== 'object' || value === null) return false
  const cache = value as Record<string, unknown>
  return (
    (cache.ownerId === null || typeof cache.ownerId === 'number') &&
    typeof cache.sessionId === 'string' &&
    cache.sessionId.length > 0 &&
    Array.isArray(cache.messages)
  )
}

const readChatCache = (): ChatCache | null => {
  const raw = localStorage.getItem(CHAT_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isChatCache(parsed) ? parsed : null
  } catch {
    // JSON hong: coi nhu khong co cache.
    return null
  }
}

const clearLegacyCache = () => {
  for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key)
}

const clearChatCache = () => {
  localStorage.removeItem(CHAT_CACHE_KEY)
  clearLegacyCache()
}

// Cache ghi kem chu so huu: nguoi dang nhap sau khong doc duoc hoi thoai cua nguoi truoc.
const saveChatCache = (cache: ChatCache) => {
  try {
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // quota day hoac storage bi chan: bo qua, hoi thoai van chay trong phien.
  }
}

// Tang khi doi tai khoan hoac lam moi hoi thoai; phan hoi dang bay cua chu cu bi bo.
let requestEpoch = 0

/**
 * Dong bo cache chatbot theo tai khoan. Goi tu App.vue vi widget chi mount o layout khach,
 * nen trang dang nhap/dang ky khong tu don duoc cache.
 */
export const syncChatOwner = (ownerId: number | null) => {
  requestEpoch += 1
  const cached = readChatCache()
  if (cached && cached.ownerId === ownerId) return
  // Khach vang lai: chi bo cache co chu, de ban cu khong so huu con duoc migrate mot lan.
  if (ownerId === null) {
    localStorage.removeItem(CHAT_CACHE_KEY)
    return
  }
  clearChatCache()
}

const isGreetingOnly = (messages: ChatMessage[]): boolean =>
  messages.length === 0 || messages.every((m) => m.sender === 'BOT' && KNOWN_GREETING_BUBBLES.has(m.content))

// Lich su chi giu the/nut cua tin bot cuoi, giong luc chat truc tiep.
const keepLastBotActions = (messages: ChatMessage[]): ChatMessage[] => {
  let lastBot = -1
  messages.forEach((m, index) => {
    if (m.sender === 'BOT') lastBot = index
  })
  return messages.map((m, index) =>
    m.sender === 'BOT' && index !== lastBot ? { sender: 'BOT', content: m.content } : m,
  )
}

const fromHistoryEntry = (entry: ChatHistoryEntry): ChatMessage => ({
  sender: entry.sender,
  content: entry.content,
  foods: entry.foods ?? undefined,
  intent: entry.intent ?? undefined,
  citations: entry.citations ?? undefined,
  quickReplies: entry.quickReplies ?? undefined,
})

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

const loadLegacySession = () => {
  // Khach cu con hoi thoai multi-session: lay doan dang mo, thieu thi lay doan dau tien.
  try {
    const raw = localStorage.getItem('chatbot.messages')
    const legacyId = localStorage.getItem('chatbot.sessionId')
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : null
    if (parsed && parsed.length > 0) {
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
        return { messages: withoutStaleGreeting(picked.messages), sessionId: picked.id || crypto.randomUUID() }
      }
    }
  } catch {
    // storage hong thi bo; dung loi chao moi.
  }
  return null
}

// Hoi thoai chi duoc dung lai khi cache thuoc dung nguoi dang dung may.
const loadChatCache = (ownerId: number | null) => {
  const cached = readChatCache()
  if (cached) {
    clearLegacyCache()
    if (cached.ownerId === ownerId) {
      return { messages: withoutStaleGreeting(cached.messages), sessionId: cached.sessionId }
    }
    // Cache cua tai khoan khac: bo han thay vi hien cho nguoi dang dung may.
    clearChatCache()
    return freshGreeting()
  }
  const legacy = ownerId === null ? loadLegacySession() : null
  clearLegacyCache()
  return legacy ?? freshGreeting()
}

/**
 * Hoi thoai widget noi: mot session duy nhat luu qua localStorage nen mo lai
 * khung chat van giu nguyen ngu canh. Lam moi hoi thoai se cap sessionId moi.
 */
// Trang thai hoi thoai chatbot: streaming chu, lastFoodIds, xoa foods cua tin bot cu.
export const useChatConversation = () => {
  const auth = useAuthStore()
  const input = ref('')
  const loading = ref(false)
  const statusText = ref<string | null>(null)
  const error = ref(false)
  const initial = loadChatCache(auth.user?.id ?? null)
  const messages = ref<ChatMessage[]>(initial.messages)
  const sessionId = ref<string>(initial.sessionId)
  const status = ref<ChatbotStatus | null>(null)
  const sessions = ref<ChatSessionSummary[]>([])
  const sessionsLoading = ref(false)
  const unavailable = computed(() => status.value?.available === false)
  const statusNotice = computed(() => status.value?.notice ?? CHATBOT_OFF_NOTICE)

  let progressTimer: number | undefined
  let abortController: AbortController | null = null

  // Luu ngu canh vao localStorage moi khi hoi thoai hoac session doi, kem chu so huu hien tai.
  watch([messages, sessionId], () => {
    saveChatCache({ ownerId: auth.user?.id ?? null, sessionId: sessionId.value, messages: messages.value })
  }, { deep: true })

  onMounted(async () => {
    try {
      status.value = await getChatbotStatus()
    } catch {
      status.value = { available: false, notice: null }
    }
    // Khach da dang nhap co cache thi giu hoi thoai cu; may moi thi lay phien moi nhat tu server.
    if (auth.user?.role === 'CUSTOMER' && isGreetingOnly(messages.value)) {
      try {
        await restoreLatest()
      } catch {
        // Loi mang: giu loi chao va de nguoi dung mo lai lich su sau.
      }
    }
  })

  // Doi tai khoan: bo cache va hoi thoai dang hien, roi nap lich su cua nguoi moi.
  watch(
    () => auth.user?.id ?? null,
    async (id, previous) => {
      if (id === previous) return
      syncChatOwner(id)
      sessions.value = []
      resetChat()
      if (auth.user?.role === 'CUSTOMER' && isGreetingOnly(messages.value)) {
        try {
          await restoreLatest()
        } catch {
          // Loi mang: giu loi chao va de nguoi dung mo lai lich su sau.
        }
      }
    },
  )

  const pushBotMessage = (content: string, foods: ChatMessage['foods'] = [], citations?: ChatCitation[], intent?: string, quickReplies?: string[]) => {
    // Chi tin bot moi nhat con the va nut hanh dong; tin cu giu noi dung chu.
    messages.value = [
      ...messages.value.map((m) => (m.sender === 'BOT' ? { sender: 'BOT' as const, content: m.content } : m)),
      { sender: 'BOT', content, foods, citations, intent, quickReplies },
    ]
  }

  const clearProgress = () => {
    if (progressTimer) {
      window.clearTimeout(progressTimer)
      progressTimer = undefined
    }
  }

  // 1 luot AI duy nhat: chi hien 1 trang thai don gian trong luc cho.
  const startProgress = (_isInfo: boolean) => {
    clearProgress()
    statusText.value = 'Đang trả lời...'
  }

  onBeforeUnmount(() => {
    clearProgress()
    abortController?.abort()
  })

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input.value).trim()
    if (!text || loading.value || unavailable.value) return
    input.value = ''
    const history = messages.value.filter((m) => m.sender === 'USER').map((m) => m.content).slice(-3)
    const lastBotWithFoods = [...messages.value].reverse().find((m) => m.sender === 'BOT' && Array.isArray(m.foods) && m.foods.length > 0)
    const lastFoodIds = lastBotWithFoods?.foods?.map((f) => f.id) ?? []
    messages.value = [...messages.value, { sender: 'USER', content: text }]
    loading.value = true
    // 1 luot AI duy nhat: chi hien trang thai don gian.
    startProgress(false)

    // Doi tai khoan hoac lam moi hoi thoai trong luc cho: bo phan hoi cua chu cu.
    const epoch = requestEpoch
    abortController = new AbortController()
    const signal = abortController.signal
    try {
      const res = await chat(text, sessionId.value, history, lastFoodIds, signal)
      if (epoch !== requestEpoch) return
      clearProgress()
      error.value = false
      const foods = (res.foods || []).slice(0, 5)
      const citations = res.citations || undefined
      const intent = res.intent || undefined
      const quickReplies = res.quickReplies || undefined
      pushBotMessage(res.reply, foods, citations, intent, quickReplies)
    } catch (e) {
      if (epoch !== requestEpoch) return
      clearProgress()
      if ((e as { name?: string }).name === 'CanceledError' || (e as { code?: string }).code === 'ERR_CANCELED') return
      const httpStatus = (e as { response?: { status?: number } }).response?.status
      if (httpStatus === 429) {
        error.value = true
        messages.value = [...messages.value, { sender: 'BOT', content: 'Quá nhiều yêu cầu, bạn thử lại sau ít phút nhé!' }]
        return
      }
      if (httpStatus === 503) {
        status.value = { available: false, notice: apiErrorMessage(e) ?? CHATBOT_OFF_NOTICE }
        error.value = false
        return
      }
      error.value = true
      messages.value = [...messages.value, { sender: 'BOT', content: 'Mình chưa gửi được câu hỏi, bạn thử lại nhé!' }]
    } finally {
      // Chi ha loading cho chinh luot nay, tranh tat loading cua luot moi hon.
      if (epoch === requestEpoch) {
        loading.value = false
        statusText.value = null
        abortController = null
      }
    }
  }

  const cancelRequest = () => {
    abortController?.abort()
    clearProgress()
    loading.value = false
    statusText.value = null
  }

  const handleRetry = () => {
    // Thu lai cau gan nhat cua khach.
    const lastUser = [...messages.value].reverse().find((m) => m.sender === 'USER')
    if (!lastUser) return
    error.value = false
    void handleSend(lastUser.content)
  }

  const resetChat = () => {
    requestEpoch += 1
    abortController?.abort()
    abortController = null
    clearProgress()
    messages.value = greetingMessages()
    sessionId.value = crypto.randomUUID()
    input.value = ''
    error.value = false
    loading.value = false
    statusText.value = null
  }

  // Nap mot phien tu server: huy request dang chay de khong tron hai hoi thoai.
  const applyHistory = (detail: { sessionId: string; messages: ChatHistoryEntry[] }) => {
    requestEpoch += 1
    abortController?.abort()
    abortController = null
    clearProgress()
    messages.value = keepLastBotActions(detail.messages.map(fromHistoryEntry))
    sessionId.value = detail.sessionId
    error.value = false
    loading.value = false
    statusText.value = null
  }

  const restoreLatest = async () => {
    const list = await listChatSessions()
    sessions.value = list
    if (list.length === 0) return
    applyHistory(await getChatSession(list[0]!.sessionId))
  }

  const loadSessions = async () => {
    if (auth.user?.role !== 'CUSTOMER') return
    sessionsLoading.value = true
    try {
      sessions.value = await listChatSessions()
    } catch {
      // Giu danh sach cu de lan mo sau van thay lich su da tai.
    } finally {
      sessionsLoading.value = false
    }
  }

  const openSession = async (id: string) => {
    if (loading.value) return false
    try {
      applyHistory(await getChatSession(id))
      return true
    } catch {
      return false
    }
  }

  const removeSession = async (id: string) => {
    try {
      await deleteChatSession(id)
    } catch {
      return false
    }
    sessions.value = sessions.value.filter((s) => s.sessionId !== id)
    if (sessionId.value === id) resetChat()
    return true
  }

  return {
    input,
    setInput: (v: string) => { input.value = v },
    loading: loading as Readonly<Ref<boolean>>,
    statusText: statusText as Readonly<Ref<string | null>>,
    error: error as Readonly<Ref<boolean>>,
    messages,
    status,
    unavailable,
    statusNotice,
    sessionId,
    sessions,
    sessionsLoading,
    loadSessions,
    openSession,
    removeSession,
    handleSend,
    handleRetry,
    resetChat,
    stopStreaming: cancelRequest,
    cancelRequest,
  }
}
