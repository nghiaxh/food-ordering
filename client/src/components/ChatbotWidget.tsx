import { useRef, useState, useEffect } from 'react'
import { Input, Tooltip, message } from 'antd'
import { MessageOutlined, CloseOutlined, SendOutlined, ShoppingCartOutlined, ReloadOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { chat, getChatbotStatus } from '../api/api'
import type { ChatMessage, ChatbotStatus, Food, FoodCard } from '../types'
import { formatVND } from '../utils/format'
import { apiErrorMessage } from '../utils/api-error'
import { useHasBottomBar } from '../hooks/useHasBottomBar'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import UiButton from './UiButton'
import UiImg from './UiImg'

const SUGGESTIONS = [
  'Gợi ý món chay không cay',
  'Món ngon dưới 200k cho 2 người',
  'Món nào không chứa hải sản?',
  '1 món chính và 1 món uống khoảng 150k',
]

const GREETING =
  'Chào bạn! Mình gợi ý món theo khẩu vị, ngân sách và số người ăn. Bạn đang muốn ăn gì?'

/** Câu báo trợ lý chưa dùng được; server cũng dùng đúng câu này trong mã 503. */
const CHATBOT_OFF_NOTICE = 'Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.'

/**
 * Câu trả lời về trong một lần (server không stream), nên chữ được chạy dần ở client
 * để khung chat có cảm giác đang gõ. Chia đều khoảng 140 nhịp mỗi câu, câu dài chạy nhanh
 * hơn câu ngắn nhưng tổng thời gian chờ khoảng 2 giây.
 */
const STREAM_TICK_MS = 16
const STREAM_TICKS = 140

/**
 * Cửa sổ chatbot cố định ở mọi trang như yêu cầu mục 2.4.1: chạm vào màn hình đang xem
 * vẫn hỏi được mà không phải rời trang. Component tự giữ trạng thái mở vì layout không
 * còn dùng state đó cho việc khác.
 *
 * Tin của bot là chữ thuần trên nền sáng, không bong bóng; chỉ tin khách mới có nền hổ phách
 * và căn phải. Nhờ vậy phần thẻ món là khung duy nhất có viền trong khung chat, mắt dừng
 * đúng chỗ cần xem.
 */
export default function ChatbotWidget() {
  const location = useLocation()
  const bottomBar = useHasBottomBar()
  const open = useUiStore((s) => s.chatOpen)
  const openChat = useUiStore((s) => s.openChat)
  const closeChat = useUiStore((s) => s.closeChat)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'BOT', content: GREETING }])
  // Tin bot đang chạy chữ: nội dung đầy đủ, số ký tự đã hiện và thẻ món chờ hiện sau cùng.
  const [draft, setDraft] = useState<{ content: string; shown: number; foods: FoodCard[] } | null>(null)
  // Server chỉ cho dùng trợ lý khi đã cấu hình khóa AI; thiếu khóa thì khung chat chỉ để xem.
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const unavailable = status?.available === false
  const statusNotice = status?.notice ?? CHATBOT_OFF_NOTICE
  // sessionId giữ một phiên chat; các ref bên dưới dùng cho thao tác gửi lại và vòng đời widget.
  const sessionId = useRef(crypto.randomUUID())
  const lastUserRef = useRef('')
  // ID món của tin bot gần nhất, gửi kèm để server hiểu câu hỏi tiếp ("món đó").
  const lastFoodIdsRef = useRef<number[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  // Khi widget đóng, request đang chạy không được cập nhật state của component.
  const activeRef = useRef(true)

  // Kiểm tra một lần khi mount; lỗi mạng thì để lần gửi đầu tiên tự phát hiện qua mã 503.
  useEffect(() => {
    getChatbotStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (list && typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight })
    }
    // `draft` đổi mỗi nhịp chạy chữ nên khung chat vẫn bám đáy trong lúc chữ hiện dần.
  }, [messages, loading, draft])

  // Chạy chữ cho câu trả lời vừa nhận; xong hết mới đưa tin vào lịch sử kèm thẻ món.
  useEffect(() => {
    if (!draft) return
    if (draft.shown >= draft.content.length) {
      pushBotMessage(draft.content, draft.foods)
      setDraft(null)
      return
    }
    // Câu càng dài bước càng lớn để tổng thời gian chạy chữ không tăng theo độ dài.
    const step = Math.max(2, Math.ceil(draft.content.length / STREAM_TICKS))
    const timer = window.setTimeout(() => {
      setDraft((d) => (d ? { ...d, shown: Math.min(d.content.length, d.shown + step) } : d))
    }, STREAM_TICK_MS)
    return () => window.clearTimeout(timer)
  }, [draft])

  const user = useAuthStore((s) => s.user)
  const isAdmin = location.pathname.startsWith('/admin') || user?.role === 'ADMIN'
  const addToCart = useCartStore((s) => s.add)
  // Chưa đăng nhập vẫn xem được gợi ý nhưng không thêm được vào giỏ (giỏ cần token).
  const canAdd = user !== null && user.role !== 'ADMIN'

  const handleAddToCart = async (e: React.MouseEvent, f: FoodCard) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAdd) return
    const portions = f.portions && f.portions > 0 ? f.portions : 1
    await addToCart(f as unknown as Food, portions)
    message.success(`Đã thêm ${portions}x ${f.name} vào giỏ!`)
  }

  /**
   * Chỉ tin bot mới nhất được giữ thẻ món: tin cũ vẫn còn chữ nhưng mất `foods`, nên khung
   * chat không dồn ngày càng nhiều thẻ và khách không tưởng món cũ là gợi ý hiện tại.
   */
  const pushBotMessage = (content: string, foods: FoodCard[]) => {
    setMessages((current) => [
      ...current.map((m) => (m.sender === 'BOT' ? { sender: m.sender, content: m.content } : m)),
      { sender: 'BOT', content, foods },
    ])
  }

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || loading || unavailable) return
    // Câu trước còn đang chạy chữ thì đẩy nốt vào lịch sử, tránh mất tin khi hỏi tiếp.
    if (draft) {
      pushBotMessage(draft.content, draft.foods)
      setDraft(null)
    }
    setInput('')
    lastUserRef.current = text
    // 3 câu gần nhất của khách giúp AI hiểu đại từ ở câu hỏi tiếp.
    const history = messages.filter((m) => m.sender === 'USER').map((m) => m.content).slice(-3)
    setMessages((m) => [...m, { sender: 'USER', content: text }])
    setLoading(true)
    try {
      const res = await chat(text, sessionId.current, history, lastFoodIdsRef.current)
      if (!activeRef.current) return
      // `res.foods` đã được server lọc và ánh xạ từ entity; không lấy món từ nội dung AI.
      // Server trả rỗng khi không phân tích được câu hỏi, đừng tự bịa món thay thế.
      setError(false)
      const foods = res.foods.slice(0, 5)
      // Tin mới không có món thì clear ngữ cảnh, tránh "món đó" trỏ về lượt đã mất thẻ.
      lastFoodIdsRef.current = foods.map((f) => f.id)
      // Chữ chạy dần thay vì bung cả khối; người tắt chuyển động thì hiện ngay.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pushBotMessage(res.reply, foods)
      } else {
        setDraft({ content: res.reply, shown: 0, foods })
      }
    } catch (e) {
      if (!activeRef.current) return
      // 503 là server báo chưa cấu hình khóa AI: khóa khung chat luôn thay vì mời thử lại,
      // vì gửi lại lúc này chắc chắn vẫn lỗi. Banner đã nêu lý do nên không thêm tin bot.
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
      if (activeRef.current) setLoading(false)
    }
  }

  const handleRetry = () => {
    // Retry dùng lại câu hỏi gần nhất; handleSend sẽ thêm lượt chat mới vào luồng hiện tại.
    if (!lastUserRef.current) return
    setError(false)
    void handleSend(lastUserRef.current)
  }

  const handleClose = () => {
    activeRef.current = false
    closeChat()
    setLoading(false)
  }

  const handleOpen = () => {
    activeRef.current = true
    openChat()
  }

  /** Làm mới hội thoại: bỏ ngữ cảnh cũ để câu hỏi tiếp không dính vào món của lượt trước. */
  const resetChat = () => {
    setMessages([{ sender: 'BOT', content: GREETING }])
    setDraft(null)
    setInput('')
    setError(false)
    setLoading(false)
    sessionId.current = crypto.randomUUID()
    lastUserRef.current = ''
    lastFoodIdsRef.current = []
    activeRef.current = true
  }

  // Hero và empty state mở chat bằng store, không đi qua nút nổi, nên phải bật lại cờ sống.
  useEffect(() => {
    if (open) activeRef.current = true
  }, [open])

  // Chatbot không hiển thị trong khu vực quản trị để tránh che lấp giao diện admin.
  if (isAdmin) return null

  // Thiếu khóa AI thì khung chat không có gì để nói: ẩn cả câu chào lẫn gợi ý, chỉ còn banner
  // và ô nhập đã khóa. Nếu khách đang chat dở mà server mất khóa giữa chừng thì giữ hội thoại.
  const showBody = !unavailable || messages.some((m) => m.sender === 'USER')

  // Tin đang chạy chữ được render như tin thường để dùng chung khung bong bóng và thẻ món.
  const streamingMessage: ChatMessage | null = draft
    ? {
        sender: 'BOT',
        content: draft.content.slice(0, draft.shown),
        foods: draft.shown >= draft.content.length ? draft.foods : [],
      }
    : null
  const renderedMessages = streamingMessage ? [...messages, streamingMessage] : messages

  return (
    // Cả cụm bám trang: bắt đầu ngay dưới thanh điều hướng và kết thúc trên nút mở, nên
    // khung chat tự co giãn theo chiều cao màn hình thay vì phải hard-code một chiều cao.
    // `pointer-events-none` để vùng trống không chặn thao tác lên thẻ món phía sau.
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 flex flex-col items-end justify-end gap-3 px-4 sm:px-5 ${
        // Thanh checkout cao ~4.75rem.
        bottomBar ? 'pb-[6.25rem]' : 'pb-2 sm:pb-3'
      }`}
    >
      {open && (
        <div className="chat-open pointer-events-auto flex min-h-0 w-[420px] max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-2xl shadow-amber-900/10 max-h-[600px] max-sm:max-h-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0">
          <div className="flex shrink-0 items-center gap-2 bg-amber-600 px-3 py-2">
            {/* `m-0` vì reset của AntD cho `p` margin-bottom 14px, làm thanh tiêu đề cao
                thêm 2px và đẩy chữ lệch lên so với nút đóng. */}
            <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-white">
              Trợ lý gợi ý món ăn
            </p>
            <Tooltip title="Làm mới hội thoại" placement="bottom">
              <button
                type="button"
                aria-label="Làm mới hội thoại"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 transition hover:bg-white/15 hover:text-white"
                onClick={resetChat}
              >
                <ReloadOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Đóng trợ lý" placement="bottom">
              <button
                type="button"
                aria-label="Đóng trợ lý"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 transition hover:bg-white/15 hover:text-white"
                onClick={handleClose}
              >
                <CloseOutlined />
              </button>
            </Tooltip>
          </div>

          {unavailable ? (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
              {statusNotice}
            </div>
          ) : null}

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-stone-50/70 p-3">
            {showBody && renderedMessages.map((m, index) => {
              const foods = m.foods ?? []
              const isBot = m.sender === 'BOT'
              const isStreaming = draft !== null && index === renderedMessages.length - 1
              return (
                <div key={index} className={isBot ? '' : 'flex justify-end'}>
                  <div className={isBot ? 'max-w-[92%]' : 'max-w-[85%]'}>
                    {isBot ? (
                      <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200/70">
                        {m.content}
                        {isStreaming && draft && draft.shown < draft.content.length && (
                          <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-stone-400 align-middle" />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-br-md bg-amber-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">
                        {m.content}
                      </div>
                    )}

                    {/* Thẻ món gợi ý gộp trong một khung, các dòng ngăn bằng đường kẻ:
                        hình, tên, giá và liên kết tới trang chi tiết theo Bảng 2.22. */}
                    {foods.length > 0 && (
                      <div className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/70">
                        {foods.map((f) => (
                          <Link
                            key={f.id}
                            to={`/foods/${f.id}`}
                            className="flex items-center gap-2.5 px-2.5 py-2 transition hover:bg-amber-50"
                          >
                            <UiImg
                              src={f.imageUrl}
                              alt={f.name}
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                              {f.name}
                              {/* Khách hỏi theo số người nên món có thể phải gọi nhiều phần;
                                  hiện số phần cạnh tên và tổng tiền để khách thấy đúng số phải trả. */}
                              {f.portions && f.portions > 1 ? (
                                <span className="ml-1.5 text-xs font-normal text-stone-500">
                                  x{f.portions} phần
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-amber-700">
                              {f.portions && f.portions > 1 && f.totalPrice
                                ? formatVND(Number(f.totalPrice))
                                : formatVND(Number(f.price))}
                            </span>
                            {/* Bọc trong span để tooltip vẫn hiện khi nút bị disabled, và
                                chặn link cha điều hướng khi khách vãng lai bấm vào. */}
                            <Tooltip title={canAdd ? null : (user?.role === 'ADMIN' ? 'Tài khoản quản trị không đặt món' : 'Đăng nhập để thêm món vào giỏ')}>
                              <span
                                className="ml-1 inline-flex shrink-0"
                                onClick={(e) => {
                                  if (canAdd) return
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={!canAdd}
                                  onClick={(e) => void handleAddToCart(e, f)}
                                  aria-label={`Thêm ${f.name} vào giỏ`}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-600 hover:text-white disabled:pointer-events-none disabled:bg-stone-100 disabled:text-stone-400"
                                >
                                  <ShoppingCartOutlined className="text-xs" />
                                </button>
                              </span>
                            </Tooltip>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Gợi ý nằm dưới tin chào đầu, chỉ ở hội thoại mới hoặc vừa làm mới. */}
                    {index === 0 && !unavailable && messages.length <= 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={loading}
                            className="cursor-pointer rounded-full bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200/70 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleSend(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 ring-1 ring-stone-200/70">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {error && !loading && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-full bg-white px-3.5 py-2 text-xs font-medium text-amber-700 ring-1 ring-stone-200 transition hover:bg-amber-50"
              >
                Thử lại
              </button>
            )}
          </div>

          {/* Nút gửi nằm trong ô nhập để khung chat đỡ một phần tử và không bó hẹp ô nhập. */}
          <div className="shrink-0 border-t border-stone-100 bg-white p-2.5">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={() => handleSend()}
              placeholder={unavailable ? 'Trợ lý đang tạm tắt' : 'Nhập câu hỏi về món ăn...'}
              disabled={loading || unavailable}
              aria-label="Nhập câu hỏi cho chatbot"
              suffix={
                <button
                  type="button"
                  aria-label="Gửi câu hỏi"
                  disabled={!input.trim() || loading || unavailable}
                  onClick={() => handleSend()}
                  className="grid h-9 w-9 place-items-center rounded-full bg-amber-600 text-white transition hover:bg-amber-500 disabled:bg-stone-200"
                >
                  <SendOutlined />
                </button>
              }
              className="!h-11 !pr-1.5"
            />
          </div>
        </div>
      )}

      <UiButton
        kind="fab"
        aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý'}
        className={`pointer-events-auto shrink-0 ${open ? 'max-sm:invisible' : ''}`}
        icon={open ? <CloseOutlined /> : <MessageOutlined />}
        onClick={open ? handleClose : handleOpen}
      />
    </div>
  )
}