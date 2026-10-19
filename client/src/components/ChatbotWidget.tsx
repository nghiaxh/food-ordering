import { useRef, useState, useEffect } from 'react'
import { Button, Card, Input, List, Space, Typography, FloatButton } from 'antd'
import { MessageOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
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
    <Card
      title="Chatbot tư vấn món ăn"
      extra={<Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} aria-label="Đóng" />}
      style={{ position: 'fixed', right: 16, bottom: 16, width: 380, maxWidth: 'calc(100vw - 32px)', zIndex: 1000, boxShadow: '0 8px 30px rgba(0,0,0,.18)' }}
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
                        </Link>
                        <div>
                          <Typography.Text type="danger">{formatVND(f.price)}</Typography.Text>
                        </div>
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
