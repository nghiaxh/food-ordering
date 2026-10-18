import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Input, InputNumber, List, Popconfirm, Select, Table, Upload, message,
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
import { EmptyState, PageHeader, PageSection } from './shared'

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
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('')

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
    setProvider(settings.provider ?? 'gemini')
    setModel(settings.model ?? '')
  }, [data])

  const { run: saveSettings, pending: savingSettings } = useAsyncAction(() =>
    Promise.all([
      adminSaveSetting('max_suggestions', String(maxSuggestions)),
      adminSaveSetting('extra_rules', extraRules),
      adminSaveSetting('provider', provider),
      adminSaveSetting('model', model.trim()),
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
    <div>
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

      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
        <span>
          {statPlaceholder ?? stats.documents} tài liệu tri thức · {statPlaceholder ?? stats.messages} tin nhắn ·{' '}
          {statPlaceholder ?? stats.sessions} phiên hội thoại
        </span>
      </div>

      <PageSection
        className="mb-6"
        title="Cấu hình AI tư vấn"
        subtitle="max_suggestions: nhiều nhất bao nhiêu món AI được gợi ý. extra_rules: yêu cầu phụ (ưu tiên món, giờ phục vụ...). Chỉ thêm; AI luôn dựa trên cơ sở dữ liệu món ăn thật."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-stone-700">
              Nhà cung cấp AI
            </label>
            <Select
              id="ai-provider"
              className="mt-1.5 w-full sm:w-56"
              value={provider}
              onChange={setProvider}
              options={[
                { label: 'Google Gemini', value: 'gemini' },
                { label: 'OpenAI', value: 'openai' },
              ]}
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Khóa API vẫn nằm ở máy chủ, không gửi xuống trình duyệt.
            </p>
          </div>
          <div>
            <label htmlFor="ai-model" className="block text-sm font-medium text-stone-700">
              Tên mô hình
            </label>
            <Input
              id="ai-model"
              className="mt-1.5"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Để trống để dùng mô hình mặc định đã cấu hình cho nhà cung cấp trên.
            </p>
          </div>
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
      </PageCard>

      <PageSection
        className="mb-6"
        title="Tài liệu tri thức (RAG)"
        subtitle="Tải lên file .pdf, .docx, .txt hoặc .md về món ăn, chính sách... AI sẽ dùng để trả lời chính xác hơn."
        extra={
          <Upload
            accept=".pdf,.docx,.txt,.md"
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
                hint="Upload file .pdf, .docx, .txt hoặc .md để AI trả lời chính xác hơn."
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
              }}
            >
              <Button loading={uploading} icon={<UploadOutlined />}>
                Upload tài liệu
              </Button>
            </Upload>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            Tải lên file .txt, .md hoặc .pdf về món ăn, chính sách... AI sẽ dùng để trả lời chính xác hơn.
          </p>
          <List
            className="mt-4 !max-w-xl"
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
                  title={d.title}
                  description={`${d.content.length.toLocaleString('vi-VN')} ký tự · ${new Date(d.createdAt).toLocaleDateString('vi-VN')}`}
                />
              </List.Item>
            )}
          />
        </div>
      </PageCard>

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
            rowKey="id"
            dataSource={history}
            loading={loading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <div className="flex flex-col items-center py-10 text-stone-400">
                  <UiIcon name="inbox" size={32} className="mb-2 text-stone-300" />
                  <p className="text-sm">Chưa có phiên chat nào.</p>
                </div>
              ),
            }}
            columns={[
              { title: 'Phiên', width: 120, render: (_, h) => <code className="text-xs">{h.sessionId}</code> },
              {
                title: 'Khách',
                width: 140,
                render: (_, h) => (h.user ? h.user.email : <Tag>Ẩn danh</Tag>),
              },
              {
                title: 'Tin nhắn',
                render: (_, h) => (
                  <div className="flex flex-col gap-1 text-sm">
                    {h.sender === 'BOT' ? (
                      <span className="text-stone-500">
                        <b className="text-amber-700">Bot:</b> {h.content}
                      </span>
                    ) : (
                      <span className="text-stone-500">
                        <b className="text-stone-700">User:</b> {h.content}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: 'Thời gian',
                width: 150,
                render: (_, h) => new Date(h.createdAt).toLocaleString('vi-VN'),
              },
            ]}
          />
        </div>
      </PageCard>
    </div>
  )
}