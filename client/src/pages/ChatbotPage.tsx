import { useRef, useEffect, useState } from 'react'
import { Input, Tooltip, message, Modal } from 'antd'
import { SendOutlined, ShoppingCartOutlined, ReloadOutlined, StopOutlined, PlusOutlined, DeleteOutlined, MenuOutlined, CloseOutlined, LikeOutlined, DislikeOutlined, MessageOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useChatConversation, SUGGESTION_GROUPS_LIST } from '../hooks/useChatConversation'
import { formatVND } from '../utils/format'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import UiImg from '../components/UiImg'
import type { Food, FoodCard } from '../types'

function formatTime(after: number): string {
  const diff = Date.now() - after
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(after).toLocaleDateString('vi-VN')
}

export default function ChatbotPage() {
  const {
    input, setInput, loading, statusText, error, messages, draft,
    unavailable, statusNotice, handleSend, handleRetry, resetChat,
    stopStreaming, submitFeedback, isStreaming,
    sessions, activeId, activeSession, createSession, switchSession, deleteSession,
  } = useChatConversation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)
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

  const handleNewChat = () => {
    createSession()
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus?.(), 50)
  }

  const handleSelectSession = (id: string) => {
    switchSession(id)
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus?.(), 50)
  }

  const handleDeleteSession = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    Modal.confirm({
      title: 'Xóa đoạn chat này?',
      content: `Bạn có chắc muốn xóa đoạn chat "${title}" không?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okType: 'danger',
      onOk: () => deleteSession(id),
    })
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

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-stone-100 p-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex h-10 w-full items-center justify-center rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Đoạn chat mới
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-stone-400">Đoạn chat</p>
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-stone-400">Chưa có đoạn chat</p>
        ) : (
          sessions.map((s) => {
            const isActive = s.id === activeId
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSession(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectSession(s.id) } }}
                className={`group mb-1 flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 transition ${
                  isActive ? 'bg-stone-100' : 'hover:bg-stone-50'
                }`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <MessageOutlined className="text-xs" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{s.title}</span>
                  <span className="mt-0.5 block text-[11px] text-stone-400">{formatTime(s.updatedAt)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Xóa đoạn chat ${s.title}`}
                  onClick={(e) => handleDeleteSession(e, s.id, s.title)}
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <DeleteOutlined className="text-xs" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-[calc(100dvh-var(--header-h))] min-h-0 overflow-hidden bg-white">
      <aside aria-label="Danh sách đoạn chat" className="hidden w-[280px] shrink-0 flex-col border-r border-stone-200/80 bg-white md:flex">
        {sidebarContent}
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button type="button" aria-label="Đóng danh sách đoạn chat" className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside aria-label="Danh sách đoạn chat" className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-3 py-2.5">
              <p className="m-0 text-sm font-semibold text-stone-900">Đoạn chat</p>
              <button type="button" aria-label="Đóng danh sách" onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
                <CloseOutlined />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{sidebarContent}</div>
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 bg-amber-600 px-3 py-3 sm:px-4">
          <button type="button" aria-label="Mở danh sách đoạn chat" onClick={() => setSidebarOpen(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 hover:bg-white/15 hover:text-white md:hidden">
            <MenuOutlined />
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold text-white">Trợ lý gợi ý món ăn - Toàn trang</p>
            <p className="m-0 truncate text-[11px] text-amber-100/90">{activeSession?.title ?? 'Đoạn chat mới'}</p>
          </div>
          <Tooltip title="Đoạn chat mới">
            <button type="button" aria-label="Đoạn chat mới" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 hover:bg-white/15 hover:text-white" onClick={handleNewChat}>
              <PlusOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Làm mới hội thoại">
            <button type="button" aria-label="Làm mới hội thoại" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-100 hover:bg-white/15 hover:text-white" onClick={resetChat}>
              <ReloadOutlined />
            </button>
          </Tooltip>
        </div>
        {unavailable && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">{statusNotice}</div>
        )}
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-white p-3 sm:p-5">
          {statusText && loading ? <p className="text-xs text-amber-800">{statusText}</p> : null}
          {renderedMessages.map((m, index) => {
            const foods = m.foods ?? []
            const isBot = m.sender === 'BOT'
            const isStreamingMsg = draft !== null && index === renderedMessages.length - 1
            return (
              <div key={index} className={isBot ? '' : 'flex justify-end'}>
                <div className={isBot ? 'max-w-[92%]' : 'max-w-[85%]'}>
                  {isBot ? (
                    <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200/70">
                      {m.content}
                      {isStreamingMsg ? <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-stone-400 align-middle" /> : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl rounded-br-md bg-amber-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{m.content}</div>
                  )}
                  {isBot && m.citations && m.citations.length > 0 ? (
                    <p className="mt-1 text-[11px] text-stone-500">Nguồn: {m.citations.map((c) => c.sourceName).join(', ')}</p>
                  ) : null}
                  {isBot && !isStreamingMsg && index === renderedMessages.length - 1 && index > 0 ? (
                    <div className="mt-1 flex gap-2">
                      <button type="button" aria-label="Hài lòng" className="text-xs text-stone-500 hover:text-amber-700" onClick={() => submitFeedback(index, 'up')}><LikeOutlined /></button>
                      <button type="button" aria-label="Chưa hài lòng" className="text-xs text-stone-500 hover:text-amber-700" onClick={() => submitFeedback(index, 'down')}><DislikeOutlined /></button>
                    </div>
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
                </div>
              </div>
            )
          })}
          {!unavailable && messages.length <= 2 && (
            <div className="rounded-xl bg-stone-50 px-3.5 py-3 ring-1 ring-stone-200/70">
              <p className="m-0 text-xs font-semibold text-stone-700">Gợi ý nhanh</p>
              <div className="mt-2 space-y-2">
                {Object.entries(SUGGESTION_GROUPS_LIST).map(([group, items]) => (
                  <div key={group}>
                    <p className="text-[11px] font-medium text-stone-500">{group}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {items.map((s) => (
                        <button key={s} type="button" disabled={loading} className="rounded-full bg-white px-2.5 py-1.5 text-xs text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100 disabled:opacity-50" onClick={() => handleSend(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading && (
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 ring-1 ring-stone-200/70">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
            </div>
          )}
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
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => handleSend()}
            placeholder={unavailable ? 'Trợ lý đang tạm tắt' : 'Ví dụ: cho 2 người 200k, không cay...'}
            disabled={loading || unavailable}
            aria-label="Nhập câu hỏi cho chatbot"
            suffix={
              <button type="button" aria-label="Gửi câu hỏi" disabled={!input.trim() || loading || unavailable} onClick={() => handleSend()} className="grid h-9 w-9 place-items-center rounded-full bg-amber-600 text-white hover:bg-amber-500 disabled:bg-stone-200">
                <SendOutlined />
              </button>
            }
            className="!h-11 !pr-1.5"
          />
        </div>
      </section>
    </div>
  )
}
