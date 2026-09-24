import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Input, InputNumber, List, Popconfirm, Table, Upload, message,
} from 'antd'
import { DeleteOutlined, InfoCircleOutlined, UploadOutlined } from '@ant-design/icons'
import {
  adminDeleteDocument, adminGetChatHistory, adminGetDocuments, adminGetSettings,
  adminSaveSetting, adminUploadDocument,
} from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { ChatHistoryMessage, KnowledgeDocument } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { EmptyState, PageCard, PageHeader, PageSection, StatCard } from './shared'

function docMeta(d: KnowledgeDocument): string {
  const ext = d.title.includes('.') ? d.title.split('.').pop()!.toUpperCase() : 'TXT'
  const size = (d.content.length / 1024).toFixed(1)
  return `${ext} · ${size} KB · ${new Date(d.createdAt).toLocaleDateString('vi-VN')}`
}

function MessageRow({ message }: { message: ChatHistoryMessage }) {
  const [expanded, setExpanded] = useState(false)
  const long = message.content.length > 200
  const text = long && !expanded ? `${message.content.slice(0, 200)}…` : message.content
  return (
    <div className="rounded-lg bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-100">
      <p className="text-xs font-medium text-stone-400">
        {message.sender === 'BOT' ? 'Bot' : 'User'} ·{' '}
        {new Date(message.createdAt).toLocaleTimeString('vi-VN')}
      </p>
      <p className="mt-1 break-words whitespace-pre-wrap">{text}</p>
      {long ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-amber-700 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      ) : null}
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Chatbot" subtitle="Cấu hình AI tư vấn và dữ liệu tri thức." />

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
        <StatCard label="Tài liệu RAG" value={documents.length} tone="purple" icon="file" />
        <StatCard label="Tin nhắn chat" value={history.length} tone="blue" icon="message" />
        <StatCard label="Phiên chat" value={sessions.length} tone="green" icon="users" />
        <StatCard label="Món gợi ý tối đa" value={maxSuggestions} tone="amber" icon="settings" />
      </div>

      <PageSection
        className="mb-6"
        title="Cấu hình AI tư vấn"
        subtitle="max_suggestions: nhiều nhất bao nhiêu món AI được gợi ý. extra_rules: yêu cầu phụ (ưu tiên món, giờ phục vụ...). Chỉ thêm; AI luôn dựa trên cơ sở dữ liệu món ăn thật."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-stone-600">Số món tối đa</span>
          <InputNumber
            min={1}
            max={10}
            value={maxSuggestions}
            onChange={(v) => setMaxSuggestions(Number(v))}
          />
        </div>
        <div className="mt-3">
          <Input.TextArea
            rows={3}
            value={extraRules}
            onChange={(e) => setExtraRules(e.target.value)}
            placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..."
          />
        </div>
        <Button type="primary" className="mt-4" loading={savingSettings} onClick={onSaveSettings}>
          Lưu cài đặt
        </Button>
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
          locale={{ emptyText: 'Chưa có tài liệu nào. Hãy upload tài liệu đầu tiên.' }}
          renderItem={(d) => (
            <List.Item
              actions={[
                <Popconfirm key="del" title="Xóa tài liệu?" onConfirm={() => onRemoveDocument(d.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Xóa
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<span className="font-medium text-stone-800">{d.title}</span>}
                description={<span className="text-xs text-stone-400">{docMeta(d)}</span>}
              />
            </List.Item>
          )}
        />
      </PageSection>

      <PageCard>
        <div className="p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <UiIcon name="message" size={16} />
            </span>
            <h3 className="font-semibold text-stone-800">Lịch sử chat ({history.length})</h3>
          </div>
          <p className="mb-3 mt-2 flex items-center gap-1 text-xs text-stone-500">
            <InfoCircleOutlined /> Các phiên chat gần đây, kèm email người dùng nếu đã đăng nhập.
          </p>
          <Table
            rowKey={(s) => s.id}
            dataSource={sessions}
            loading={loading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <EmptyState
                  icon="message"
                  title="Chưa có phiên chat nào."
                  hint="Khách hàng chat sẽ được lưu lại ở đây."
                />
              ),
            }}
            expandable={{
              expandedRowRender: (s) => (
                <div className="space-y-2 px-2 pb-2">
                  {s.messages.map((m) => (
                    <MessageRow key={m.id} message={m} />
                  ))}
                </div>
              ),
            }}
            columns={[
              {
                title: 'Phiên',
                width: 140,
                render: (_, s) => <code className="text-xs">{s.id.slice(0, 8)}</code>,
              },
              {
                title: 'Khách',
                width: 160,
                render: (_, s) => {
                  const lastUser = [...s.messages].reverse().find((m) => m.user)
                  return lastUser?.user?.email ? (
                    <span className="text-stone-600">{lastUser.user.email}</span>
                  ) : (
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      Ẩn danh
                    </span>
                  )
                },
              },
              { title: 'Số tin', width: 80, render: (_, s) => s.messages.length },
              {
                title: 'Tin cuối',
                render: (_, s) => {
                  const last = s.messages[s.messages.length - 1]
                  return (
                    <span className="block max-w-md truncate text-stone-500">
                      <b className={last.sender === 'BOT' ? 'text-amber-700' : 'text-stone-700'}>
                        {last.sender === 'BOT' ? 'Bot:' : 'User:'}
                      </b>{' '}
                      {last.content}
                    </span>
                  )
                },
              },
              {
                title: 'Thời gian cuối',
                width: 160,
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
        </div>
      </PageCard>
    </div>
  )
}