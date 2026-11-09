import { useEffect, useMemo, useState } from 'react'
import { Alert, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { adminGetChatHistory, adminGetSettings, adminSaveSetting, getChatbotStatus, adminGetDocuments, adminSaveDocument, adminDeleteDocument } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { ChatHistoryMessage, ChatbotStatus, KnowledgeDoc } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import { EmptyState, PageSection } from './shared'
import UiButton from '../../components/UiButton'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const MODEL_OPTIONS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
]

function Bubble({ message }: { message: ChatHistoryMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isBot = message.sender === 'BOT'
  const long = message.content.length > 200
  const text = long && !expanded ? `${message.content.slice(0, 200)}…` : message.content
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[75%]">
        <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${isBot ? 'rounded-bl-sm bg-white text-stone-700 ring-1 ring-stone-200' : 'rounded-br-sm bg-amber-600 text-white'}`}>
          {text}
        </div>
        <p className={`mt-1 text-[11px] text-stone-400 ${isBot ? '' : 'text-right'}`}>{isBot ? 'Bot' : 'User'} · {formatTime(message.createdAt)}</p>
        {long ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className={`mt-0.5 text-xs font-medium text-amber-700 hover:underline ${isBot ? '' : 'ml-auto block'}`}>{expanded ? 'Thu gọn' : 'Xem thêm'}</button>
        ) : null}
      </div>
    </div>
  )
}

function Thread({ messages }: { messages: ChatHistoryMessage[] }) {
  return <div className="space-y-2">{messages.map((m) => <Bubble key={m.id} message={m} />)}</div>
}

export default function AdminChatbotPage() {
  const [history, setHistory] = useState<ChatHistoryMessage[]>([])
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([])
  const [maxSuggestions, setMaxSuggestions] = useState(5)
  const [extraRules, setExtraRules] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null)
  const [docForm, setDocForm] = useState({ title: '', category: '', keywords: '', content: '', enabled: true })

  const { data, loading, error, refresh: fetchData } = useAsyncData(
    () => Promise.all([adminGetChatHistory(), adminGetSettings(), getChatbotStatus(), adminGetDocuments()]),
    [],
  )

  useEffect(() => {
    if (!data) return
    setHistory(data[0])
    setStatus(data[2])
    setDocuments(data[3] || [])
    const settings = Object.fromEntries(data[1].map((item) => [item.settingKey, item.settingValue]))
    setMaxSuggestions(Math.min(5, Math.max(1, Number(settings.max_suggestions ?? 5) || 5)))
    setExtraRules(settings.extra_rules ?? '')
    setProvider(settings.provider === 'gemini' ? 'gemini' : 'gemini')
    setModel(settings.model ?? 'gemini-2.0-flash')
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
      adminSaveSetting('provider', provider),
      adminSaveSetting('model', model.trim()),
    ]),
  )

  const onSaveSettings = async () => {
    const res = await saveSettings()
    if (res.ok) { message.success('Đã lưu cài đặt chatbot'); void fetchData() } else message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
  }

  const openNewDoc = () => {
    setEditingDoc(null)
    setDocForm({ title: '', category: '', keywords: '', content: '', enabled: true })
    setDocModalOpen(true)
  }
  const openEditDoc = (d: KnowledgeDoc) => {
    setEditingDoc(d)
    setDocForm({ title: d.title, category: d.category || '', keywords: d.keywords || '', content: d.content, enabled: d.enabled })
    setDocModalOpen(true)
  }
  const saveDoc = async () => {
    if (!docForm.title.trim() || !docForm.content.trim()) { message.error('Tiêu đề và nội dung là bắt buộc'); return }
    try {
      await adminSaveDocument(editingDoc?.id ?? null, docForm)
      message.success('Đã lưu tài liệu')
      setDocModalOpen(false)
      void fetchData()
    } catch (e) {
      message.error(apiErrorMessage(e) ?? 'Lưu thất bại')
    }
  }
  const deleteDoc = async (id: number) => {
    Modal.confirm({
      title: 'Xóa tài liệu này?',
      content: 'Chatbot sẽ không tra được nội dung này nữa.',
      okText: 'Xóa', cancelText: 'Hủy',
      onOk: async () => {
        try { await adminDeleteDocument(id); message.success('Đã xóa tài liệu'); void fetchData() } catch (e) { message.error(apiErrorMessage(e) ?? 'Xóa thất bại') }
      },
    })
  }

  return (
    <div>
      <div className="mb-3"><h1 className="text-2xl font-bold tracking-tight text-stone-900">Cấu hình chatbot</h1></div>
      {error ? <Alert type="error" showIcon className="mb-6" message="Không tải được dữ liệu chatbot" description="Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang." /> : null}
      {status && !status.available ? (
        <Alert type="warning" showIcon className="mb-6" message="Chưa cấu hình trợ lý AI" description={<>Trợ lý chưa dùng được vì máy chủ thiếu khóa API hoặc khóa đã bị nhà cung cấp từ chối. Kiểm tra biến <code>AI_API_KEY</code> trong tệp <code>.env</code> ở thư mục gốc rồi khởi động lại máy chủ.</>} />
      ) : null}

      <PageSection className="mb-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-stone-700">Nhà cung cấp AI</label>
            <Select id="ai-provider" className="mt-2 w-full" value={provider} onChange={setProvider} options={[{ label: 'Google Gemini', value: 'gemini' }]} />
          </div>
          <div>
            <label htmlFor="ai-model" className="block text-sm font-medium text-stone-700">Tên mô hình</label>
            <Select id="ai-model" className="mt-2 w-full" value={model} onChange={setModel} options={model && !MODEL_OPTIONS.some((o) => o.value === model) ? [...MODEL_OPTIONS, { value: model, label: model }] : MODEL_OPTIONS} />
          </div>
          <div>
            <label htmlFor="max-suggestions" className="block text-sm font-medium text-stone-700">Số món gợi ý tối đa</label>
            <InputNumber id="max-suggestions" className="mt-2 w-full" min={1} max={5} value={maxSuggestions} onChange={(v) => setMaxSuggestions(Number(v))} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="extra-rules" className="block text-sm font-medium text-stone-700">Quy tắc bổ sung</label>
            <Input.TextArea id="extra-rules" className="mt-2" rows={3} value={extraRules} onChange={(e) => setExtraRules(e.target.value)} placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..." />
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
          <UiButton kind="primary" loading={savingSettings} onClick={onSaveSettings}>Lưu cài đặt</UiButton>
        </div>
      </PageSection>

      <PageSection title={`Tài liệu (${documents.length})`} subtitle="Thông tin quán chatbot tra cứu. Bot chỉ trả lời từ tài liệu đang bật, kèm nguồn." className="mb-6">
        <div className="mb-3 flex justify-end">
          <UiButton kind="primary" onClick={openNewDoc}>Thêm tài liệu</UiButton>
        </div>
        <Table
          rowKey={(d) => d.id}
          dataSource={documents}
          size="middle"
          pagination={false}
          locale={{ emptyText: <EmptyState icon="message" title="Chưa có tài liệu nào." hint="Thêm tài liệu để chatbot trả lời thông tin quán." /> }}
          columns={[
            { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
            { title: 'Nhóm', dataIndex: 'category', key: 'category', width: 120 },
            { title: 'Từ khóa', dataIndex: 'keywords', key: 'keywords', ellipsis: true },
            { title: 'Nội dung', dataIndex: 'content', key: 'content', ellipsis: true },
            { title: 'Bật', dataIndex: 'enabled', key: 'enabled', width: 80, render: (v: boolean) => (v ? 'Có' : 'Không') },
            {
              title: 'Thao tác', key: 'actions', width: 160,
              render: (_, d: KnowledgeDoc) => (
                <div className="flex gap-2">
                  <button type="button" className="text-amber-700 hover:underline" onClick={() => openEditDoc(d)}>Sửa</button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => deleteDoc(d.id)}>Xóa</button>
                </div>
              ),
            },
          ]}
        />
      </PageSection>

      <PageSection title={`Lịch sử hội thoại (${sessions.length})`} subtitle="Mở một phiên để xem hội thoại đầy đủ. Email hiển thị nếu khách đã đăng nhập.">
        <Table
          rowKey={(s) => s.id}
          dataSource={sessions}
          loading={loading}
          size="middle"
          scroll={{ x: 720 }}
          pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState icon="message" title="Chưa có hội thoại nào." hint="Khách hàng chat sẽ được lưu lại ở đây." /> }}
          expandable={{ expandedRowRender: (s) => (<div className="rounded-xl bg-stone-50/80 p-3"><Thread messages={s.messages} /></div>) }}
          columns={[
            { title: 'Phiên', width: 130, fixed: 'left', render: (_, s) => (<code className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-500">{s.id.slice(0, 8)}</code>) },
            { title: 'Khách', width: 190, fixed: 'left', render: (_, s) => { const lastUser = [...s.messages].reverse().find((m) => m.user); return lastUser?.user?.email ? (<span className="block truncate text-stone-600">{lastUser.user.email}</span>) : (<span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">Ẩn danh</span>) } },
            { title: 'Tin nhắn', width: 90, render: (_, s) => (<span className="tabular-nums text-stone-600">{s.messages.length}</span>) },
            { title: 'Tin cuối', render: (_, s) => { const last = s.messages[s.messages.length - 1]; return (<span className="block max-w-md truncate text-stone-500"><span className={last.sender === 'BOT' ? 'text-amber-700' : 'text-stone-600'}>{last.sender === 'BOT' ? 'Bot' : 'User'} · </span>{last.content}</span>) } },
            { title: 'Hoạt động cuối', width: 170, render: (_, s) => { const last = s.messages[s.messages.length - 1]; return (<span className="tabular-nums text-stone-500">{new Date(last.createdAt).toLocaleString('vi-VN')}</span>) } },
          ]}
        />
      </PageSection>

      <Modal title={editingDoc ? 'Sửa tài liệu' : 'Thêm tài liệu'} open={docModalOpen} onOk={saveDoc} onCancel={() => setDocModalOpen(false)} okText="Lưu" cancelText="Hủy">
        <div className="space-y-4">
          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-stone-700">Tiêu đề</label>
            <Input id="doc-title" className="mt-1" value={docForm.title} onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ví dụ: Giờ mở cửa" />
          </div>
          <div>
            <label htmlFor="doc-cat" className="block text-sm font-medium text-stone-700">Nhóm</label>
            <Input id="doc-cat" className="mt-1" value={docForm.category} onChange={(e) => setDocForm((f) => ({ ...f, category: e.target.value }))} placeholder="HOURS, DELIVERY, PAYMENT, ORDER..." />
          </div>
          <div>
            <label htmlFor="doc-keys" className="block text-sm font-medium text-stone-700">Từ khóa (cách nhau dấu phẩy)</label>
            <Input id="doc-keys" className="mt-1" value={docForm.keywords} onChange={(e) => setDocForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="giờ mở cửa, mấy giờ đóng cửa" />
          </div>
          <div>
            <label htmlFor="doc-content" className="block text-sm font-medium text-stone-700">Nội dung</label>
            <Input.TextArea id="doc-content" rows={4} className="mt-1" value={docForm.content} onChange={(e) => setDocForm((f) => ({ ...f, content: e.target.value }))} placeholder="Nội dung bot trả lời khi khách hỏi..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={docForm.enabled} onChange={(v) => setDocForm((f) => ({ ...f, enabled: v }))} />
            <span className="text-sm text-stone-600">Đang bật (bot mới tra được)</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
