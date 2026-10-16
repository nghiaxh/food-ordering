import { useRef, useState, useEffect } from 'react'
import { Button, Card, Input, List, Space, Typography, FloatButton } from 'antd'
import { MessageOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { chat } from '../api/api'
import type { ChatMessage } from '../types'
import { formatVND } from '../utils/format'
import { useHasCartBar } from '../hooks/useCartBar'

const SUGGESTIONS = [
  'Phí giao hàng là bao nhiêu?',
  'Gợi ý món chay không cay',
  'Món ngon dưới 200k cho 2 người',
]

interface ChatbotWidgetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ChatbotWidget({ open, onOpenChange }: ChatbotWidgetProps) {
  const location = useLocation()
  const hasCartBar = useHasCartBar()
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
        onClick={() => setOpen(true)}
        style={{ right: 24, bottom: 24 }}
        tooltip="Hỏi chatbot tư vấn món"
      />
    )
  }

  const handleClose = () => {
    activeRef.current = false
    onOpenChange(false)
    setLoading(false)
  }

  const handleOpen = () => {
    activeRef.current = true
    onOpenChange(true)
  }

  // Chatbot không hiển thị trong khu vực quản trị để tránh che lấp giao diện admin.
  if (isAdmin) return null

  return (
    <div
      className={`fixed right-5 z-40 flex flex-col items-end gap-3 ${
        // Thanh giỏ cố định đáy chiếm ~4rem, launcher phải nằm cao hơn để không bị che.
        hasCartBar ? 'bottom-[7.25rem]' : 'bottom-5'
      }`}
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
                        </Link>
                        <div>
                          <Typography.Text type="danger">{formatVND(f.price)}</Typography.Text>
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

      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={send}
          placeholder="VD: món Việt, không cay, 150k cho 2 người"
        />
        <Button type="primary" icon={<SendOutlined />} onClick={send} loading={loading} />
      </Space.Compact>
    </Card>
  )
}