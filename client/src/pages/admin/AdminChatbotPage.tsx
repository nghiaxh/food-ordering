import { useEffect, useState } from 'react'
import {
  Alert, Button, Input, InputNumber, List, Popconfirm, Table, Tag, Upload, message,
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
import { PageCard } from './shared'

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
      {error ? (
        <Alert
          type="error"
          showIcon
          className="mb-6"
          message="Không tải được dữ liệu chatbot"
          description="Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang."
        />
      ) : null}

      <PageCard className="mb-6">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <UiIcon name="settings" size={16} />
            </span>
            <h3 className="font-semibold text-stone-800">Cấu hình AI tư vấn</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            max_suggestions: nhiều nhất bao nhiêu món AI được gợi ý. extra_rules: yêu cầu phụ (ưu tiên
            món, giờ phục vụ...). Chỉ thêm; AI luôn dựa trên cơ sở dữ liệu món ăn thật.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-stone-600">Số món tối đa</span>
            <InputNumber
              min={1}
              max={10}
              value={maxSuggestions}
              onChange={(v) => setMaxSuggestions(Number(v))}
            />
          </div>
          <div className="mt-3 max-w-xl">
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
        </div>
      </PageCard>

      <PageCard className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <UiIcon name="file" size={16} />
              </span>
              <h3 className="font-semibold text-stone-800">Tài liệu tri thức (RAG)</h3>
            </div>
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