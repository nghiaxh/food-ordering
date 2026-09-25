import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Input, InputNumber, List, Popconfirm, Table, Upload, message,
} from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import {
  adminDeleteDocument, adminGetChatHistory, adminGetDocuments, adminGetSettings,
  adminSaveSetting, adminUploadDocument,
} from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { ChatHistoryMessage, KnowledgeDocument } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { EmptyState, PageHeader, PageSection, StatCard } from './shared'

function docExt(title: string): string {
  return title.includes('.') ? title.split('.').pop()!.toUpperCase() : 'TXT'
}

function docMeta(d: KnowledgeDocument): string {
  const size = (d.content.length / 1024).toFixed(1)
  const date = new Date(d.createdAt).toLocaleDateString('vi-VN')
  return `${docExt(d.title)} · ${size} KB · ${date}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

/** Một tin trong luồng chat — cùng ngôn ngữ bong bóng với widget chat ngoài site. */
function Bubble({ message }: { message: ChatHistoryMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isBot = message.sender === 'BOT'
  const long = message.content.length > 200
  const text = long && !expanded ? `${message.content.slice(0, 200)}…` : message.content
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[75%]">
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
            isBot
              ? 'rounded-bl-sm bg-white text-stone-700 ring-1 ring-stone-200'
              : 'rounded-br-sm bg-amber-600 text-white'
          }`}
        >
          {text}
        </div>
        <p className={`mt-1 text-[11px] text-stone-400 ${isBot ? '' : 'text-right'}`}>
          {isBot ? 'Bot' : 'User'} · {formatTime(message.createdAt)}
        </p>
        {long ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`mt-0.5 text-xs font-medium text-amber-700 hover:underline ${
              isBot ? '' : 'ml-auto block'
            }`}
          >
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Thread({ messages }: { messages: ChatHistoryMessage[] }) {
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
    </div>
  )
}

export default function AdminChatbotPage() {
  const [history, setHistory] = useState<ChatHistoryMessage[]>([])
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [maxSuggestions, setMaxSuggestions] = useState(5)
  const [extraRules, setExtraRules] = useState('')

  const { data, loading, error, refresh: fetchData } = useAsyncData(
    () => Promise.all([adminGetChatHistory(), adminGetDocuments(), adminGetSettings()]),
    [],
  )

  useEffect(() => {
    if (!data) return
    setHistory(data[0])
    setDocuments(data[1])
    const settings = Object.fromEntries(data[2].map((item) => [item.settingKey, item.settingValue]))
    setMaxSuggestions(Number(settings.max_suggestions ?? 5))
    setExtraRules(settings.extra_rules ?? '')
  }, [data])

  const sessions = useMemo(() => {
    const groups = new Map<string, ChatHistoryMessage[]>()
    for (const h of history) {
      const list = groups.get(h.sessionId) ?? []
      list.push(h)
      groups.set(h.sessionId, list)
    }
    return Array.from(groups.entries()).map(([id, messages]) => ({ id, messages }))
  }, [history])

  const stats = useMemo(() => {
    const emails = new Set<string>()
    let anonymousSessions = 0
    for (const s of sessions) {
      const sessionEmails = s.messages.filter((m) => m.user?.email).map((m) => m.user!.email)
      for (const e of sessionEmails) emails.add(e)
      if (sessionEmails.length === 0) anonymousSessions += 1
    }
    return {
      documents: documents.length,
      messages: history.length,
      sessions: sessions.length,
      customers: emails.size,
      anonymousSessions,
    }
  }, [sessions, history, documents])

  const { run: saveSettings, pending: savingSettings } = useAsyncAction(() =>
    Promise.all([
      adminSaveSetting('max_suggestions', String(maxSuggestions)),
      adminSaveSetting('extra_rules', extraRules),
    ]),
  )

  const { run: deleteDocument } = useAsyncAction((id: number) => adminDeleteDocument(id))

  const onSaveSettings = async () => {
    const res = await saveSettings()
    if (res.ok) {
      message.success('Đã lưu cài đặt chatbot')
      void fetchData()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
    }
  }

  const onRemoveDocument = async (id: number) => {
    const res = await deleteDocument(id)
    if (res.ok) {
      message.success('Đã xóa tài liệu')
      void fetchData()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Xóa thất bại')
    }
  }

  const statPlaceholder = loading && !data ? '–' : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Chatbot"
        subtitle="Điều hành trợ lý AI tư vấn món: quy tắc gợi ý, nguồn tri thức và lịch sử hội thoại."
      />

      {error ? (
        <Alert
          type="error"
          showIcon
          className="mb-6"
          message="Không tải được dữ liệu chatbot"
          description="Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang."
        />
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tài liệu tri thức" value={statPlaceholder ?? stats.documents} />
        <StatCard label="Tin nhắn chat" value={statPlaceholder ?? stats.messages} />
        <StatCard label="Phiên hội thoại" value={statPlaceholder ?? stats.sessions} />
        <StatCard
          label="Khách đã chat"
          value={statPlaceholder ?? stats.customers}
          hint={
            stats.anonymousSessions > 0
              ? `+${stats.anonymousSessions} phiên ẩn danh`
              : 'Khách đã đăng nhập khi chat'
          }
        />
      </div>

      <PageSection
        className="mb-6"
        title="Cấu hình AI tư vấn"
        subtitle="Điều chỉnh cách trợ lý gợi ý món và quy tắc trả lời cho khách."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="max-suggestions" className="block text-sm font-medium text-stone-700">
              Số món gợi ý tối đa
            </label>
            <InputNumber
              id="max-suggestions"
              className="mt-1.5"
              min={1}
              max={10}
              value={maxSuggestions}
              onChange={(v) => setMaxSuggestions(Number(v))}
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Nhiều nhất bao nhiêu món được AI đề xuất trong một câu trả lời (1–10).
            </p>
          </div>
          <div>
            <label htmlFor="extra-rules" className="block text-sm font-medium text-stone-700">
              Quy tắc bổ sung
            </label>
            <Input.TextArea
              id="extra-rules"
              className="mt-1.5"
              rows={3}
              value={extraRules}
              onChange={(e) => setExtraRules(e.target.value)}
              placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..."
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Yêu cầu phụ: ưu tiên món, giờ phục vụ... AI luôn đề xuất dựa trên món ăn thật trong hệ thống.
            </p>
          </div>
          <div className="flex justify-end border-t border-stone-100 pt-4">
            <Button type="primary" loading={savingSettings} onClick={onSaveSettings}>
              Lưu cài đặt
            </Button>
          </div>
        </div>
      </PageSection>

      <PageSection
        className="mb-6"
        title="Tài liệu tri thức (RAG)"
        subtitle="Tải lên file .txt, .md hoặc .pdf về món ăn, chính sách... AI sẽ dùng để trả lời chính xác hơn."
        extra={
          <Upload
            accept=".txt,.md,.pdf"
            showUploadList={false}
            customRequest={async (options) => {
              const file = options.file as unknown as File
              if (!file) return
              setUploading(true)
              try {
                await adminUploadDocument(file)
                message.success('Đã upload tài liệu')
                void fetchData()
              } catch {
                message.error('Upload thất bại')
              } finally {
                setUploading(false)
              }
            }}
          >
            <Button loading={uploading} icon={<UploadOutlined />}>
              Upload tài liệu
            </Button>
          </Upload>
        }
      >
        <List
          dataSource={documents}
          loading={loading}
          locale={{
            emptyText: (
              <EmptyState
                icon="file"
                title="Chưa có tài liệu tri thức nào."
                hint="Upload file .txt, .md hoặc .pdf để AI trả lời chính xác hơn."
              />
            ),
          }}
          renderItem={(d) => (
            <List.Item
              className="gap-3"
              actions={[
                <Popconfirm key="del" title="Xóa tài liệu?" onConfirm={() => onRemoveDocument(d.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Xóa
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-stone-100 text-stone-500">
                    <UiIcon name="file" size={16} />
                  </span>
                }
                title={<span className="truncate text-sm font-medium text-stone-800">{d.title}</span>}
                description={<span className="text-xs tabular-nums text-stone-400">{docMeta(d)}</span>}
              />
            </List.Item>
          )}
        />
      </PageSection>

      <PageSection
        title={`Lịch sử hội thoại (${sessions.length})`}
        subtitle="Mở một phiên để xem hội thoại đầy đủ. Email hiển thị nếu khách đã đăng nhập."
      >
        <Table
          rowKey={(s) => s.id}
          dataSource={sessions}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <EmptyState
                icon="message"
                title="Chưa có hội thoại nào."
                hint="Khách hàng chat sẽ được lưu lại ở đây."
              />
            ),
          }}
          expandable={{
            expandedRowRender: (s) => (
              <div className="rounded-xl bg-stone-50/80 p-3">
                <Thread messages={s.messages} />
              </div>
            ),
          }}
          columns={[
            {
              title: 'Phiên',
              width: 130,
              render: (_, s) => (
                <code className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-500">
                  {s.id.slice(0, 8)}
                </code>
              ),
            },
            {
              title: 'Khách',
              width: 190,
              render: (_, s) => {
                const lastUser = [...s.messages].reverse().find((m) => m.user)
                return lastUser?.user?.email ? (
                  <span className="block truncate text-stone-600">{lastUser.user.email}</span>
                ) : (
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    Ẩn danh
                  </span>
                )
              },
            },
            {
              title: 'Tin nhắn',
              width: 90,
              render: (_, s) => (
                <span className="tabular-nums text-stone-600">{s.messages.length}</span>
              ),
            },
            {
              title: 'Tin cuối',
              render: (_, s) => {
                const last = s.messages[s.messages.length - 1]
                return (
                  <span className="block max-w-md truncate text-stone-500">
                    <span className={last.sender === 'BOT' ? 'text-amber-700' : 'text-stone-600'}>
                      {last.sender === 'BOT' ? 'Bot' : 'User'} ·{' '}
                    </span>
                    {last.content}
                  </span>
                )
              },
            },
            {
              title: 'Hoạt động cuối',
              width: 170,
              render: (_, s) => {
                const last = s.messages[s.messages.length - 1]
                return (
                  <span className="tabular-nums text-stone-500">
                    {new Date(last.createdAt).toLocaleString('vi-VN')}
                  </span>
                )
              },
            },
          ]}
        />
      </PageSection>
    </div>
  )
}