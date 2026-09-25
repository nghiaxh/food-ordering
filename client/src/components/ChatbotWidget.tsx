import { useRef, useState, useEffect } from 'react'
import { Button, Input, Typography } from 'antd'
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { chat } from '../api/api'
import type { ChatMessage } from '../types'
import { formatVND } from '../utils/format'

const SUGGESTIONS = [
  'Phí giao hàng là bao nhiêu?',
  'Gợi ý món chay không cay',
  'Món ngon dưới 200k cho 2 người',
]

export default function ChatbotWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'BOT',
      content:
        'Xin chào! Mình là chatbot tư vấn món ăn của FoodOrdering. Hãy cho mình biết khẩu vị, ngân sách hoặc số người nhé!',
    },
  ])
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
  const isFoodDetail = /^\/foods\/\d+$/.test(location.pathname)

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
      setError(false)
      setMessages((m) => [...m, { sender: 'BOT', content: res.reply, foods: res.foods }])
    } catch {
      if (!activeRef.current) return
      setError(true)
      setMessages((m) => [...m, { sender: 'BOT', content: 'Xin lỗi, đã có lỗi xảy ra. Bạn thử lại nhé!' }])
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

  return (
    <div
      className={`fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3 ${
        isFoodDetail ? 'bottom-24 lg:bottom-5' : 'max-sm:bottom-20'
      }`}
    >
      {open && (
        <div className="flex h-[560px] w-[400px] max-h-[min(560px,calc(100vh-7rem))] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-2xl shadow-amber-900/10 transition-all duration-200 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0">
          <div className="flex items-center gap-3 bg-amber-600 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <RobotOutlined className="text-lg text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                Trợ lý FoodOrdering
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </p>
              <p className="truncate text-xs text-amber-100">Gợi ý món theo khẩu vị · hỗ trợ 24/7</p>
            </div>
            <button
              type="button"
              aria-label="Đóng trợ lý"
              className="grid h-10 w-10 place-items-center rounded-full text-amber-100 transition hover:bg-white/10 hover:text-white"
              onClick={handleClose}
            >
              <CloseOutlined />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
            {messages.map((m, index) => (
              <div
                key={index}
                className={`flex ${m.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.sender === 'USER'
                        ? 'rounded-br-sm bg-amber-600 text-white'
                        : 'rounded-bl-sm bg-white text-stone-700 shadow-sm'
                    }`}
                  >
                    {m.content ? <span>{m.content}</span> : null}
                  </div>

                  {m.foods && m.foods.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {m.foods.map((f) => (
                        <Link
                          key={f.id}
                          to={`/foods/${f.id}`}
                          className="flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-stone-100"
                        >
                          <img
                            src={f.imageUrl}
                            width={40}
                            height={40}
                            alt={f.name}
                            className="h-10 w-10 rounded-lg object-cover"
                            loading="lazy"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-amber-700">{f.name}</span>
                            <Typography.Text type="danger" className="block text-xs">
                              {formatVND(Number(f.price))}
                            </Typography.Text>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-amber-50"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!loading && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-50"
                    onClick={() => handleSend(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-stone-100 bg-white p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={() => handleSend()}
                placeholder="VD: món Việt, không cay, 150k cho 2 người"
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                disabled={!input.trim() || loading}
                onClick={() => handleSend()}
              />
            </div>
          </div>
        </div>
      )}

      <Button
        type="primary"
        shape="circle"
        size="large"
        aria-label="Mở trợ lý"
        className={`h-20 w-20 text-2xl shadow-lg shadow-amber-900/20 ${open ? 'max-sm:invisible' : ''}`}
        icon={open ? <CloseOutlined /> : <MessageOutlined />}
        onClick={open ? handleClose : handleOpen}
      />
    </div>
  )
}