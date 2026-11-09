import { useRef, useEffect } from 'react'
import { Input, Tooltip, message } from 'antd'
import { MessageOutlined, CloseOutlined, SendOutlined, ShoppingCartOutlined, ReloadOutlined, FullscreenOutlined, LikeOutlined, DislikeOutlined, StopOutlined } from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Food, FoodCard } from '../types'
import { formatVND } from '../utils/format'
import { useHasBottomBar } from '../hooks/useHasBottomBar'
import { useChatConversation, SUGGESTION_GROUPS_LIST } from '../hooks/useChatConversation'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import UiButton from './UiButton'
import UiImg from './UiImg'

/**
 * Widget chatbot nổi ở mọi trang khách. Logic hội thoại nằm ở useChatConversation
 * để trang full page /chatbot dùng chung một session.
 */
export default function ChatbotWidget() {
  const location = useLocation()
  const navigate = useNavigate()
  const bottomBar = useHasBottomBar()
  const open = useUiStore((s) => s.chatOpen)
  const openChat = useUiStore((s) => s.openChat)
  const closeChat = useUiStore((s) => s.closeChat)

  const {
    input, setInput, loading, statusText, error, messages, draft,
    unavailable, statusNotice, activeRef, handleSend, handleRetry,
    resetChat, stopStreaming, submitFeedback, isStreaming,
  } = useChatConversation()

  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = listRef.current
    if (list && typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight })
  }, [messages, loading, draft])

  useEffect(() => {
    if (open) activeRef.current = true
  }, [open])

  const user = useAuthStore((s) => s.user)
  const isAdmin = location.pathname.startsWith('/admin') || user?.role === 'ADMIN'
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

  const handleClose = () => {
    activeRef.current = false
    closeChat()
  }
  const handleOpen = () => {
    activeRef.current = true
    openChat()
  }
  const handleMaximize = () => {
    closeChat()
    navigate('/chatbot')
  }

  if (isAdmin) return null
  const showBody = !unavailable || messages.some((m) => m.sender === 'USER')
  const streamingMessage = draft
    ? {
        sender: 'BOT' as const,
        content: draft.content.split(/\s+/).slice(0, draft.shownWords).join(' '),
        foods: draft.content.split(/\s+/).length <= draft.shownWords ? draft.foods : [],
        citations: draft.content.split(/\s+/).length <= draft.shownWords ? draft.citations : undefined,
        intent: draft.intent,
      }
    : null
  const renderedMessages = streamingMessage ? [...messages, streamingMessage] : messages

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 flex flex-col items-end justify-end gap-3 px-4 sm:px-5 ${
        bottomBar ? 'pb-[6.25rem] lg:pb-3' : 'pb-2 sm:pb-3'
      }`}
    >
      {open && (
        <div
          data-testid="chatbot-panel"
          className="chat-open pointer-events-auto flex min-h-0 w-[420px] max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-2xl shadow-amber-900/10 max-h-[600px] max-sm:max-h-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0"
        >
          <div className="flex shrink-0 items-center gap-2 bg-amber-600 px-3 py-2">
            <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-white">
              Trợ lý gợi ý món ăn
            </p>
            <Tooltip title="Toàn trang" placement="bottom">
              <button
                type="button"
                aria-label="Mở toàn trang"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 transition hover:bg-white/15 hover:text-white"
                onClick={handleMaximize}
              >
                <FullscreenOutlined />
              </button>
            </Tooltip>
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
            {statusText && loading ? (
              <p className="text-xs text-amber-800">{statusText}</p>
            ) : null}
            {showBody && renderedMessages.map((m, index) => {
              const foods = m.foods ?? []
              const isBot = m.sender === 'BOT'
              const isStreaming = draft !== null && index === renderedMessages.length - 1
              return (
                <div key={index} className={isBot ? '' : 'flex justify-end'}>
                  <div className={isBot ? 'max-w-[92%]' : 'max-w-[85%]'}>
                    {isBot ? (
                      <div
                        data-testid="chatbot-bot-message"
                        className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200/70"
                      >
                        {m.content}
                        {isStreaming && (
                          <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-stone-400 align-middle" />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-br-md bg-amber-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">
                        {m.content}
                      </div>
                    )}

                    {isBot && m.citations && m.citations.length > 0 ? (
                      <p className="mt-1 text-[11px] text-stone-500">
                        Nguồn: {m.citations.map((c) => c.sourceName).join(', ')}
                      </p>
                    ) : null}

                    {isBot && !isStreaming && index === renderedMessages.length - 1 && index > 0 ? (
                      <div className="mt-1 flex gap-2">
                        <button type="button" aria-label="Hài lòng" className="text-xs text-stone-500 hover:text-amber-700" onClick={() => submitFeedback(index, 'up')}><LikeOutlined /></button>
                        <button type="button" aria-label="Chưa hài lòng" className="text-xs text-stone-500 hover:text-amber-700" onClick={() => submitFeedback(index, 'down')}><DislikeOutlined /></button>
                      </div>
                    ) : null}

                    {foods.length > 0 && (
                      <div className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/70">
                        {foods.map((f) => (
                          <Link
                            key={f.id}
                            to={`/foods/${f.id}`}
                            data-testid="chatbot-food-card"
                            className="flex items-center gap-2.5 px-2.5 py-2 transition hover:bg-amber-50"
                          >
                            <UiImg
                              src={f.imageUrl}
                              alt={f.name}
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                              {f.name}
                              {f.portions && f.portions > 1 ? (
                                <span className="ml-1.5 text-xs font-normal text-stone-500">
                                  x{f.portions} phần
                                </span>
                              ) : null}
                            </span>
                            <span
                              data-testid="chatbot-food-total"
                              className="shrink-0 text-sm font-bold tabular-nums text-amber-700"
                            >
                              {f.portions && f.portions > 1 && f.totalPrice
                                ? formatVND(Number(f.totalPrice))
                                : formatVND(Number(f.price))}
                            </span>
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

                    {index === 0 && !unavailable && messages.length <= 1 && (
                      <div className="mt-2 space-y-2">
                        {Object.entries(SUGGESTION_GROUPS_LIST).map(([group, items]) => (
                          <div key={group}>
                            <p className="text-[11px] font-medium text-stone-500">{group}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {items.map((s) => (
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
                          </div>
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
            {isStreaming && (
              <button
                type="button"
                onClick={stopStreaming}
                className="rounded-full bg-white px-3.5 py-2 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-50"
              >
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
