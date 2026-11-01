import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Input, InputNumber, Select, Table, message,
} from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import {
  adminGetChatHistory, adminGetSettings, adminSaveSetting,
} from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { ChatHistoryMessage } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import UiIcon from '../../components/UiIcon'
import { PageSection } from './shared'
import UiButton from '../../components/UiButton'



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
  const [maxSuggestions, setMaxSuggestions] = useState(5)
  const [extraRules, setExtraRules] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('')

  const { data, loading, error, refresh: fetchData } = useAsyncData(
    () => Promise.all([adminGetChatHistory(), adminGetSettings()]),
    [],
  )

  useEffect(() => {
    if (!data) return
    setHistory(data[0])
    const settings = Object.fromEntries(data[1].map((item) => [item.settingKey, item.settingValue]))
    setMaxSuggestions(Number(settings.max_suggestions ?? 5))
    setExtraRules(settings.extra_rules ?? '')
    setProvider(settings.provider ?? 'gemini')
    setModel(settings.model ?? '')
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
    if (res.ok) {
      message.success('Đã lưu cài đặt chatbot')
      void fetchData()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
    }
  }




  return (
    <div>
      <div className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Cấu hình chatbot</h1>
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          className="mb-6"
          message="Không tải được dữ liệu chatbot"
          description="Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang."
        />
      ) : null}

      <PageSection
        className="mb-6"
        title="Cấu hình AI tư vấn"
        subtitle="Mô hình, số gợi ý và quy tắc trả lời."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-stone-700">
              Nhà cung cấp AI
            </label>
            <Select
              id="ai-provider"
              className="mt-2 w-full"
              value={provider}
              onChange={setProvider}
              options={[
                { label: 'Google Gemini', value: 'gemini' },
                { label: 'OpenAI', value: 'openai' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="ai-model" className="block text-sm font-medium text-stone-700">
              Tên mô hình
            </label>
            <Input
              id="ai-model"
              className="mt-2"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
            />
          </div>
          <div>
            <label htmlFor="max-suggestions" className="block text-sm font-medium text-stone-700">
              Số món gợi ý tối đa
            </label>
            <InputNumber
              id="max-suggestions"
              className="mt-2 w-full"
              min={1}
              max={10}
              value={maxSuggestions}
              onChange={(v) => setMaxSuggestions(Number(v))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="extra-rules" className="block text-sm font-medium text-stone-700">
              Quy tắc bổ sung
            </label>
            <Input.TextArea
              id="extra-rules"
              className="mt-2"
              rows={3}
              value={extraRules}
              onChange={(e) => setExtraRules(e.target.value)}
              placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..."
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
          <UiButton kind="primary" loading={savingSettings} onClick={onSaveSettings}>
            Lưu cài đặt
          </UiButton>
        </div>
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
