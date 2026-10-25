import { useRef, useState, useEffect } from 'react'
import { Button, Card, Input, List, Space, Typography, FloatButton } from 'antd'
import { MessageOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { chat } from '../api/api'
import type { ChatMessage } from '../types'
import { formatVND } from '../utils/format'
import { useHasCartBar } from '../hooks/useCartBar'

const SUGGESTIONS = [
  'Gợi ý món chay không cay',
  'Món ngon dưới 200k cho 2 người',
  'Món nào không chứa hải sản?',
  '1 món chính và 1 món uống khoảng 150k',
]

interface ChatbotWidgetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Cửa sổ chatbot cố định ở mọi trang như yêu cầu mục 2.4.1: chạm vào màn hình đang xem
 * vẫn hỏi được mà không phải rời trang.
 */
export default function ChatbotWidget({ open, onOpenChange }: ChatbotWidgetProps) {
  const location = useLocation()
  const hasCartBar = useHasCartBar()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'BOT',
      content:
        'Chào bạn! Mình gợi ý món theo khẩu vị, ngân sách và số người ăn. Bạn đang muốn ăn gì?',
    },
  ])
  const sessionId = useRef(crypto.randomUUID())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const isAdmin = location.pathname.startsWith('/admin')

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || loading) return
    setMessages((m) => [...m, { sender: 'USER', content: text }])
    setInput('')
    setLoading(true)
    try {
      const res = await chat(text, sessionId.current)
      setMessages((m) => [...m, { sender: 'BOT', content: res.reply, foods: res.foods }])
    } catch {
      setMessages((m) => [...m, { sender: 'BOT', content: 'Xin lỗi, đã có lỗi xảy ra. Bạn thử lại nhé!' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <FloatButton
        type="primary"
        icon={<MessageOutlined />}
        onClick={() => onOpenChange(true)}
        style={{ right: 24, bottom: hasCartBar ? 88 : 24 }}
        tooltip="Hỏi chatbot tư vấn món"
      />
    )
  }

  if (isAdmin) return null

  return (
    <Card
      title="Chatbot tư vấn món ăn"
      extra={<Button type="text" icon={<CloseOutlined />} onClick={() => onOpenChange(false)} aria-label="Đóng" />}
      style={{
        position: 'fixed',
        right: 16,
        bottom: hasCartBar ? 80 : 16,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 1000,
        boxShadow: '0 8px 30px rgba(0,0,0,.18)',
      }}
      styles={{ body: { padding: 12 } }}
    >
      <div className="max-h-[380px] overflow-y-auto pb-2" style={{ height: 380 }}>
        {messages.map((m, idx) => (
          <div key={idx} className={`mb-2.5 ${m.sender === 'USER' ? 'text-right' : 'text-left'}`}>
            <div
              className="inline-block max-w-[90%] rounded-xl px-3 py-2 text-left whitespace-pre-wrap"
              style={{
                background: m.sender === 'USER' ? '#d97706' : '#f5f5f4',
                color: m.sender === 'USER' ? '#fff' : '#1c1917',
              }}
            >
              {m.content}
            </div>

            {m.foods && m.foods.length > 0 && (
              <List
                size="small"
                className="mt-1.5 text-left"
                dataSource={m.foods}
                renderItem={(f) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space>
                      <img
                        src={f.imageUrl}
                        width={48}
                        height={48}
                        alt={f.name}
                        style={{ objectFit: 'cover', borderRadius: 6 }}
                      />
                      <div>
                        <Link to={`/foods/${f.id}`} className="text-amber-700 hover:underline">
                          {f.name}
                          {f.portions && f.portions > 1 ? (
                            <span className="ml-1.5 text-xs text-stone-500">x{f.portions} phần</span>
                          ) : null}
                        </Link>
                        <div>
                          <Typography.Text type="danger">
                            {formatVND(f.portions && f.portions > 1 && f.totalPrice ? f.totalPrice : f.price)}
                          </Typography.Text>
                        </div>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </div>
        ))}
        {loading && <Typography.Text type="secondary">Chatbot đang trả lời...</Typography.Text>}
        <div ref={bottomRef} />
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 hover:bg-amber-100"
            onClick={() => handleSend(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => handleSend()}
          placeholder="VD: món Việt, không cay, 150k cho 2 người"
          disabled={loading}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend()} loading={loading} />
      </Space.Compact>
    </Card>
  )
}
