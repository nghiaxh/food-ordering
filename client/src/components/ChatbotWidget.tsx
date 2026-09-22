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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'BOT',
      content:
        'Xin chào! Mình là chatbot tư vấn món ăn của FoodOrdering. Hãy cho mình biết khẩu vị, ngân sách hoặc số người nhé!',
    },
  ])
  const sessionId = useRef(crypto.randomUUID())
  const listRef = useRef<HTMLDivElement>(null)
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
    setMessages((m) => [...m, { sender: 'USER', content: text }])
    setLoading(true)
    try {
      const res = await chat(text, sessionId.current)
      if (!activeRef.current) return
      setMessages((m) => [...m, { sender: 'BOT', content: res.reply, foods: res.foods }])
    } catch {
      if (!activeRef.current) return
      setMessages((m) => [...m, { sender: 'BOT', content: 'Xin lỗi, đã có lỗi xảy ra. Bạn thử lại nhé!' }])
    } finally {
      if (activeRef.current) setLoading(false)
    }
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

  if (isAdmin) return null

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[560px] w-[400px] max-h-[min(560px,calc(100vh-7rem))] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-2xl shadow-amber-900/10 transition-all duration-200">
          <div className="flex items-center gap-3 bg-amber-600 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <RobotOutlined className="text-lg text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Trợ lý FoodOrdering</p>
              <p className="text-xs text-amber-100">Gợi ý món theo khẩu vị · hỗ trợ 24/7</p>
            </div>
            <button
              type="button"
              aria-label="Đóng trợ lý"
              className="rounded-full p-1 text-amber-100 transition hover:bg-white/10 hover:text-white"
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
                    {m.content ? (
                      <span>{m.content}</span>
                    ) : loading && m.sender === 'BOT' && index === messages.length - 1 ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent align-middle" />
                    ) : null}
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
        className="h-20 w-20 text-2xl shadow-lg shadow-amber-900/20"
        icon={open ? <CloseOutlined /> : <MessageOutlined />}
        onClick={open ? handleClose : handleOpen}
      />
    </div>
  )
}