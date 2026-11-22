import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { chat, deleteChatSession, getChatbotStatus, getChatSession, getLatestChatSession, listChatSessions } from '@/user/chatbot/api'
import type { ChatCitation, ChatHistoryEntry, ChatMessage, ChatSessionSummary, ChatbotStatus } from '@/shared/types'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { useAuthStore } from '@/user/auth/store'

export const GREETING_INTRO = 'Chào quý khách! Tôi là trợ lý đặt món của quán.'
export const GREETING_TASKS =
  'Quý khách chưa biết ăn gì? Nhắn tôi số người và ngân sách, ví dụ: "Cho 2 người 200k, không cay". Hỏi giờ mở cửa, giao hàng hay cách đặt đơn cũng được.'

/** Bon diem vao dat duoi loi chao; bam la gui tin nhu khach tu go. */
export const GREETING_STARTERS = [
  'Gợi ý món cho 2 người',
  'Món chay không cay',
  'Giờ mở cửa là mấy giờ?',
  'Cách đặt món thế nào?',
]

const CHATBOT_OFF_NOTICE = 'Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.'

/** Trang thai tieu trinh: chat server tra 1 response tu luc dau, khong stream. */
const PROGRESS_TEXTS = ['Đang phân tích...', 'Đang tra cứu...', 'Đang soạn câu trả lời...'];
const PROGRESS_INTERVAL_MS = 3000;

/** Giu phan hoi hien it nhat 2s de khong nhay qua nhanh khi server tra ve tuc thi. */
const MIN_REPLY_MS = 2000;

/** Cho du thoi gian toi thieu; tra false neu nguoi dung huy giua luc cho. */
const waitMinimumReply = (startedAt: number, signal: AbortSignal): Promise<boolean> => {
  if (signal.aborted) return Promise.resolve(false)
  const remaining = MIN_REPLY_MS - (Date.now() - startedAt)
  if (remaining <= 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    let timer = 0
    const onAbort = () => {
      window.clearTimeout(timer)
      resolve(false)
    }
    timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    }, remaining)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const greetingMessages = (): ChatMessage[] => [
  { sender: 'BOT', content: GREETING_INTRO },
  { sender: 'BOT', content: GREETING_TASKS },
]

const KNOWN_GREETING_BUBBLES = new Set([
  GREETING_INTRO,
  GREETING_TASKS,
])

const freshGreeting = () => ({ messages: greetingMessages(), sessionId: crypto.randomUUID() })

const isGreetingOnly = (messages: ChatMessage[]): boolean =>
  messages.length === 0 || messages.every((m) => m.sender === 'BOT' && KNOWN_GREETING_BUBBLES.has(m.content))

const keepLastBotActions = (messages: ChatMessage[]): ChatMessage[] => {
  let lastBot = -1
  messages.forEach((m, index) => {
    if (m.sender === 'BOT') lastBot = index
  })
  return messages.map((m, index) =>
    m.sender === 'BOT' && index !== lastBot ? { sender: 'BOT' as const, content: m.content } : m,
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

let requestEpoch = 0

export const useChatConversation = () => {
  const auth = useAuthStore()
  const input = ref('')
  const loading = ref(false)
  const statusText = ref<string | null>(null)
  const error = ref(false)
  const initial = freshGreeting()
  const messages = ref<ChatMessage[]>(initial.messages)
  const sessionId = ref<string>(initial.sessionId)
  const status = ref<ChatbotStatus | null>(null)
  const sessions = ref<ChatSessionSummary[]>([])
  const sessionsLoading = ref(false)
  const unavailable = computed(() => status.value?.available === false)
  const statusNotice = computed(() => status.value?.notice ?? CHATBOT_OFF_NOTICE)

  let progressTimer: number | undefined
  let progressStage = 0
  let abortController: AbortController | null = null

  onMounted(async () => {
    try {
      status.value = await getChatbotStatus()
    } catch {
      status.value = { available: false, notice: null }
    }
    if (auth.user?.role === 'CUSTOMER' && isGreetingOnly(messages.value)) {
      try {
        await restoreLatest()
      } catch {
        // Loi mang: giu loi chao.
      }
    }
  })

  watch(
    () => auth.user?.id ?? null,
    async (id, previous) => {
      if (id === previous) return
      sessions.value = []
      resetChat()
      if (auth.user?.role === 'CUSTOMER' && isGreetingOnly(messages.value)) {
        try {
          await restoreLatest()
        } catch {
          // Loi mang.
        }
      }
    },
  )

  const pushBotMessage = (content: string, foods: ChatMessage['foods'] = [], citations?: ChatCitation[], intent?: string, quickReplies?: string[]) => {
    messages.value = [
      ...messages.value.map((m) => (m.sender === 'BOT' ? { sender: 'BOT' as const, content: m.content } : m)),
      { sender: 'BOT', content, foods, citations, intent, quickReplies },
    ]
  }

  const clearProgress = () => {
    if (progressTimer) {
      window.clearInterval(progressTimer)
      progressTimer = undefined
    }
    progressStage = 0
  }

  // Vong qua cac trang thai progress theo gio de vong tay nhung chu he thong
  const startProgress = (_isInfo: boolean) => {
    clearProgress()
    progressStage = 0
    statusText.value = PROGRESS_TEXTS[0]!
    progressTimer = window.setInterval(() => {
      progressStage = (progressStage + 1) % PROGRESS_TEXTS.length;
      statusText.value = PROGRESS_TEXTS[progressStage]!;
    }, PROGRESS_INTERVAL_MS);
  }

  onBeforeUnmount(() => {
    clearProgress()
    abortController?.abort()
  })

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input.value).trim()
    if (!text || loading.value || unavailable.value) return
    input.value = ''
    messages.value = [...messages.value, { sender: 'USER', content: text }]
    loading.value = true
    startProgress(false)

    const epoch = requestEpoch
    abortController = new AbortController()
    const signal = abortController.signal
    const startedAt = Date.now()
    try {
      const res = await chat(text, sessionId.value, signal)
      if (epoch !== requestEpoch) return
      if (!(await waitMinimumReply(startedAt, signal))) return
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
      if ((e as { name?: string }).name === 'CanceledError' || (e as { code?: string }).code === 'ERR_CANCELED') return
      if (!(await waitMinimumReply(startedAt, signal))) return
      if (epoch !== requestEpoch) return
      clearProgress()
      const httpStatus = (e as { response?: { status?: number } }).response?.status
      if (httpStatus === 429) {
        error.value = true
        messages.value = [...messages.value, { sender: 'BOT', content: 'Quá nhiều yêu cầu, quý khách vui lòng thử lại sau ít phút!' }]
        return
      }
      if (httpStatus === 503) {
        status.value = { available: false, notice: apiErrorMessage(e) ?? CHATBOT_OFF_NOTICE }
        error.value = false
        return
      }
      error.value = true
      messages.value = [
        ...messages.value,
        { sender: 'BOT', content: apiErrorMessage(e) ?? 'Trợ lý đang gặp sự cố, quý khách vui lòng thử lại sau ít phút!' },
      ]
    } finally {
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
    const fresh = freshGreeting()
    messages.value = fresh.messages
    sessionId.value = fresh.sessionId
    input.value = ''
    error.value = false
    loading.value = false
    statusText.value = null
  }

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
    const detail = await getLatestChatSession()
    if (detail.sessionId) {
      applyHistory({ sessionId: detail.sessionId, messages: detail.messages })
    }
  }

  const loadSessions = async () => {
    if (auth.user?.role !== 'CUSTOMER') return
    sessionsLoading.value = true
    try {
      sessions.value = await listChatSessions()
    } catch {
      // Giu danh sach cu.
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