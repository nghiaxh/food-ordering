import { useRef, useEffect } from 'react'
import { Input, Tooltip, message } from 'antd'
import { SendOutlined, ShoppingCartOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useChatConversation, SUGGESTION_GROUPS_LIST } from '../hooks/useChatConversation'
import { formatVND } from '../utils/format'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import UiImg from '../components/UiImg'
import type { Food, FoodCard } from '../types'

export default function ChatbotPage() {
  const {
    input, setInput, loading, statusText, error, messages, draft,
    unavailable, statusNotice, handleSend, handleRetry, resetChat, stopStreaming, isStreaming,
  } = useChatConversation()
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight })
  }, [messages, loading, draft])

  const closeChat = useUiStore((s) => s.closeChat)
  useEffect(() => { closeChat() }, [])

  const user = useAuthStore((s) => s.user)
  const addToCart = useCartStore((s) => s.add)
  const canAdd = user !== null && user.role !== 'ADMIN'

  const handleAddToCart = async (e: React.MouseEvent, f: FoodCard) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAdd) return
    const portions = f.portions && f.portions > 0 ? f.portions : 1
    await addToCart(f as unknown as Food, portions)
    message.success(`Đã thêm ${portions}x ${f.name} vào giỏ!`)
  }

  const streamingMessage = draft
    ? {
        sender: 'BOT' as const,
        content: draft.content.split(/\s+/).slice(0, draft.shownWords).join(' '),
        foods: draft.content.split(/\s+/).length <= draft.shownWords ? draft.foods : [],
        citations: draft.content.split(/\s+/).length <= draft.shownWords ? draft.citations : undefined,
      }
    : null
  const renderedMessages = streamingMessage ? [...messages, streamingMessage] : messages

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--header-h)-1rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between bg-amber-600 px-4 py-3">
        <p className="m-0 text-sm font-semibold text-white">Trợ lý gợi ý món ăn - Toàn trang</p>
        <Tooltip title="Làm mới hội thoại">
          <button type="button" aria-label="Làm mới hội thoại" className="grid h-8 w-8 place-items-center rounded-full text-amber-100 hover:bg-white/15 hover:text-white" onClick={resetChat}>
            <ReloadOutlined />
          </button>
        </Tooltip>
      </div>
      {unavailable && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">{statusNotice}</div>
      )}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-stone-50/70 p-4">
        {statusText && loading ? <p className="text-xs text-amber-800">{statusText}</p> : null}
        {renderedMessages.map((m, index) => {
          const foods = m.foods ?? []
          const isBot = m.sender === 'BOT'
          return (
            <div key={index} className={isBot ? '' : 'flex justify-end'}>
              <div className={isBot ? 'max-w-[92%]' : 'max-w-[85%]'}>
                {isBot ? (
                  <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200/70">{m.content}</div>
                ) : (
                  <div className="rounded-2xl rounded-br-md bg-amber-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{m.content}</div>
                )}
                {isBot && m.citations && m.citations.length > 0 ? (
                  <p className="mt-1 text-[11px] text-stone-500">Nguồn: {m.citations.map((c) => c.sourceName).join(', ')}</p>
                ) : null}
                {foods.length > 0 && (
                  <div className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/70">
                    {foods.map((f) => (
                      <Link key={f.id} to={`/foods/${f.id}`} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-amber-50">
                        <UiImg src={f.imageUrl} alt={f.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                          {f.name}
                          {f.portions && f.portions > 1 ? <span className="ml-1.5 text-xs text-stone-500">x{f.portions} phần</span> : null}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-amber-700">
                          {f.portions && f.portions > 1 && f.totalPrice ? formatVND(Number(f.totalPrice)) : formatVND(Number(f.price))}
                        </span>
                        <Tooltip title={canAdd ? null : (user?.role === 'ADMIN' ? 'Tài khoản quản trị không đặt món' : 'Đăng nhập để thêm món vào giỏ')}>
                          <span className="ml-1 inline-flex shrink-0" onClick={(e) => { if (canAdd) return; e.preventDefault(); e.stopPropagation() }}>
                            <button type="button" disabled={!canAdd} onClick={(e) => void handleAddToCart(e, f)} aria-label={`Thêm ${f.name} vào giỏ`} className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white disabled:bg-stone-100 disabled:text-stone-400">
                              <ShoppingCartOutlined className="text-xs" />
                            </button>
                          </span>
                        </Tooltip>
                      </Link>
                    ))}
                  </div>
                )}
                {index === 0 && !unavailable && messages.length <= 1 && (
                  <div className="mt-2 space-y-2">
                    {Object.entries(SUGGESTION_GROUPS_LIST).map(([group, items]) => (
                      <div key={group}>
                        <p className="text-[11px] font-medium text-stone-500">{group}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {items.map((s) => (
                            <button key={s} type="button" disabled={loading} className="rounded-full bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200/70 hover:bg-amber-100 disabled:opacity-50" onClick={() => handleSend(s)}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {error && !loading && (
          <button type="button" onClick={handleRetry} className="rounded-full bg-white px-3.5 py-2 text-xs font-medium text-amber-700 ring-1 ring-stone-200 hover:bg-amber-50">Thử lại</button>
        )}
        {isStreaming && (
          <button type="button" onClick={stopStreaming} className="rounded-full bg-white px-3.5 py-2 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50">
            <StopOutlined className="mr-1" />Dừng
          </button>
        )}
      </div>
      <div className="shrink-0 border-t border-stone-100 bg-white p-2.5">
        <p className="mb-1 text-[11px] text-stone-500">Mình chỉ trả lời từ thực đơn và thông tin đã xác thực. Giá luôn lấy từ thực đơn.</p>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => handleSend()}
          placeholder={unavailable ? 'Trợ lý đang tạm tắt' : 'Ví dụ: cho 2 người 200k, không cay...'}
          disabled={loading || unavailable}
          suffix={
            <button type="button" aria-label="Gửi câu hỏi" disabled={!input.trim() || loading || unavailable} onClick={() => handleSend()} className="grid h-9 w-9 place-items-center rounded-full bg-amber-600 text-white hover:bg-amber-500 disabled:bg-stone-200">
              <SendOutlined />
            </button>
          }
          className="!h-11 !pr-1.5"
        />
      </div>
    </div>
  )
}
