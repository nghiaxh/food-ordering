import { useRef, useState, useEffect } from 'react'
import { Input } from 'antd'
import { MessageOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { chat } from '../api/api'
import type { ChatMessage } from '../types'
import { formatVND } from '../utils/format'
import { useHasCartBar } from '../hooks/useCartBar'
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
  const hasCartBar = useHasCartBar()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'BOT', content: GREETING }])
  // sessionId giữ một phiên chat; các ref bên dưới dùng cho thao tác gửi lại và vòng đời widget.
  const sessionId = useRef(crypto.randomUUID())
  const lastUserRef = useRef('')
  const listRef = useRef<HTMLDivElement>(null)
  // Khi widget đóng, request đang chạy không được cập nhật state của component.
  const activeRef = useRef(true)

  useEffect(() => {
    const list = listRef.current
    if (list && typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight })
    }
  }, [messages, loading])

  const isAdmin = location.pathname.startsWith('/admin')

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || loading) return
    setInput('')
    lastUserRef.current = text
    setMessages((m) => [...m, { sender: 'USER', content: text }])
    setLoading(true)
    try {
      const res = await chat(text, sessionId.current)
      if (!activeRef.current) return
      // `res.foods` đã được server lọc và ánh xạ từ entity; không lấy món từ nội dung AI.
      // Server trả rỗng khi không phân tích được câu hỏi, đừng tự bịa món thay thế.
      setError(false)
      setMessages((m) => [...m, { sender: 'BOT', content: res.reply, foods: res.foods }])
    } catch {
      if (!activeRef.current) return
      setError(true)
      setMessages((m) => [...m, { sender: 'BOT', content: 'Mình chưa gửi được câu hỏi, bạn thử lại nhé!' }])
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
    setOpen(false)
    setLoading(false)
  }

  const handleOpen = () => {
    activeRef.current = true
    setOpen(true)
  }

  // Chatbot không hiển thị trong khu vực quản trị để tránh che lấp giao diện admin.
  if (isAdmin) return null

  // Ô gợi ý dính ngay dưới câu chào vì nó thuộc câu chào; sau tin nhắn đầu tiên thì thôi.
  const showSuggestions = messages.length <= 1
  // Nút mở thực đơn chỉ dính vào tin bot gần nhất để khung chat không bị dồn nút.
  const lastBotIndex = messages.reduce((acc, m, i) => (m.sender === 'BOT' ? i : acc), -1)

  return (
    // Cả cụm bám trang: bắt đầu ngay dưới thanh điều hướng và kết thúc trên nút mở, nên
    // khung chat tự co giãn theo chiều cao màn hình thay vì phải hard-code một chiều cao.
    // `pointer-events-none` để vùng trống không chặn thao tác lên thẻ món phía sau.
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 top-[3.25rem] z-40 flex flex-col items-end justify-end gap-3 px-4 sm:px-5 ${
        // Thanh giỏ ghim đáy cao ~4.75rem, launcher phải nằm cao hơn để không bị che.
        hasCartBar ? 'pb-[6.25rem]' : 'pb-4 sm:pb-5'
      }`}
    >
      {open && (
        <div className="pointer-events-auto flex min-h-0 w-[420px] max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-2xl shadow-amber-900/10 max-h-[600px] max-sm:max-h-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0">
          <div className="flex shrink-0 items-center gap-2.5 bg-amber-600 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              Trợ lý gợi ý món ăn
            </p>
            <button
              type="button"
              aria-label="Đóng trợ lý"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-amber-100 transition hover:bg-white/15 hover:text-white"
              onClick={handleClose}
            >
              <CloseOutlined />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-stone-50/70 p-3">
            {messages.map((m, index) => {
              const foods = m.foods ?? []
              const isBot = m.sender === 'BOT'
              return (
                <div key={index} className={isBot ? '' : 'flex justify-end'}>
                  <div className={isBot ? 'max-w-[92%]' : 'max-w-[85%]'}>
                    {isBot ? (
                      <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200/70">
                        {m.content}
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
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Bot không gợi ý được món nào thì chỉ ra lối ra: xem thẳng thực đơn.
                        Áp dụng cho cả lỗi, cả "không có món phù hợp" lẫn câu hỏi ngoài lề. */}
                    {isBot && foods.length === 0 && index === lastBotIndex && !loading && (
                      <Link
                        to="/"
                        onClick={handleClose}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-xs font-medium text-amber-700 ring-1 ring-stone-200 transition hover:bg-amber-50"
                      >
                        <MessageOutlined />
                        Xem thực đơn
                      </Link>
                    )}

                    {isBot && index === 0 && showSuggestions && !loading && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="rounded-full bg-white px-3 py-2.5 text-xs text-amber-700 ring-1 ring-stone-200 transition hover:bg-amber-50"
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
              placeholder="Nhập câu hỏi về món ăn..."
              disabled={loading}
              aria-label="Nhập câu hỏi cho chatbot"
              suffix={
                <button
                  type="button"
                  aria-label="Gửi câu hỏi"
                  disabled={!input.trim() || loading}
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