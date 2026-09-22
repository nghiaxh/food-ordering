import { useRef, useState, useEffect } from 'react'
import { Button, Card, Input, List, Space, Typography, FloatButton } from 'antd'
import { MessageOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { chat } from '../api/api'
import type { ChatMessage } from '../types'
import { formatVND } from '../utils/format'

export default function ChatbotWidget() {
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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
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