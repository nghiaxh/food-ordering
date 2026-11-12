<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NDataTable,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  NIcon,
  NUpload,
  NPopover,
  type DataTableColumns,
} from 'naive-ui'
import {
  CloudUploadOutline,
  InformationCircleOutline,
  EyeOutline,
  CreateOutline,
  RefreshOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import {
  adminGetChatHistory,
  adminGetSettings,
  adminSaveSetting,
  adminGetDocuments,
  adminGetDocumentChunks,
  adminSaveDocument,
  adminDeleteDocument,
  adminUploadDocument,
  adminReingestDocument,
} from '@/admin/chatbot/api'
import { getChatbotStatus } from '@/user/chatbot/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import type { ChatHistoryMessage, ChatbotStatus, KnowledgeChunkView, KnowledgeDoc } from '@/shared/types'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import { confirmRemove } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import FormModal from '@/components/FormModal.vue'
import { h } from 'vue'

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
]
// Danh sach mo hinh de xuat theo nha cung cap; admin van nhap duoc ten mo hinh khac.
const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
}
const CATEGORY_OPTIONS = [
  { value: 'HOURS', label: 'Giờ mở cửa' },
  { value: 'DELIVERY', label: 'Giao hàng' },
  { value: 'PAYMENT', label: 'Thanh toán' },
  { value: 'ORDER', label: 'Đặt / hủy đơn' },
  { value: 'SHOP', label: 'Địa chỉ quán' },
  { value: 'ALLERGY', label: 'Dị ứng, thành phần' },
  { value: 'OTHER', label: 'Khác' },
]
const statusLabel = (status?: string, enabled = true): string => {
  if (status === 'PENDING') return 'Đang xử lý'
  if (status === 'FAILED') return 'Lỗi'
  return enabled ? 'Sẵn sàng' : 'Tạm ngừng'
}
const categoryLabel = (v?: string | null): string =>
  CATEGORY_OPTIONS.find((o) => o.value === v)?.label ?? (v || 'Khác')
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

const maxSuggestions = ref(5)
const extraRules = ref('')
const provider = ref('gemini')
const model = ref('')

const docModal = ref(false)
const editingDoc = ref<KnowledgeDoc | null>(null)
const docForm = reactive({ title: '', category: '', keywords: '', content: '', enabled: true })
const chunksDoc = ref<KnowledgeDoc | null>(null)
const chunks = ref<KnowledgeChunkView[]>([])

const { data, error, refresh } = useAsyncData(
  () => Promise.all([adminGetChatHistory(), adminGetSettings(), getChatbotStatus(), adminGetDocuments()]),
  () => [],
)

watch(data, (value) => {
  if (!value) return
  const settings = Object.fromEntries(value[1].map((s) => [s.settingKey, s.settingValue]))
  maxSuggestions.value = Math.min(5, Math.max(1, Number(settings.max_suggestions ?? 5) || 5))
  extraRules.value = settings.extra_rules ?? ''
  // Doc provider/model tu cau hinh luu trong DB, khong hardcode de doi nha cung cap duoc.
  provider.value = settings.provider?.trim() || 'gemini'
  model.value = settings.model?.trim() || MODEL_OPTIONS[provider.value]?.[0]?.value || ''
}, { immediate: true })

const modelOptions = computed(() => {
  const base = MODEL_OPTIONS[provider.value] ?? []
  // Mo hinh dang luu khong nam trong danh sach goi y thi van cho chon duoc.
  return model.value && !base.some((o) => o.value === model.value)
    ? [...base, { value: model.value, label: model.value }]
    : base
})

const onProviderChange = (value: string) => {
  provider.value = value
  // Mo hinh cua nha cung cap truoc co the khong con dung nen ve danh sach goi y.
  const options = MODEL_OPTIONS[value] ?? []
  if (!options.some((o) => o.value === model.value)) {
    model.value = options[0]?.value ?? model.value
  }
}

const history = computed(() => data.value?.[0] ?? [])
const status = computed<ChatbotStatus | null>(() => (data.value?.[2] as ChatbotStatus | undefined) ?? null)
const documents = computed(() => data.value?.[3] ?? [])

const sessions = computed(() => {
  const groups = new Map<string, ChatHistoryMessage[]>()
  for (const m of history.value) {
    const list = groups.get(m.sessionId) ?? []
    list.push(m)
    groups.set(m.sessionId, list)
  }
  return [...groups.entries()].map(([id, messages]) => ({ id, messages }))
})

const { run: saveSettings, pending: savingSettings } = useAsyncAction(() =>
  Promise.all([
    adminSaveSetting('max_suggestions', String(maxSuggestions.value)),
    adminSaveSetting('extra_rules', extraRules.value),
    adminSaveSetting('provider', provider.value),
    adminSaveSetting('model', String(model.value).trim()),
  ]),
)
const onSaveSettings = async () => {
  const res = await saveSettings()
  if (res.ok) {
    message.success('Đã lưu cài đặt chatbot')
    void refresh()
  } else {
    message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
  }
}

const openEditDoc = (d: KnowledgeDoc) => {
  editingDoc.value = d
  Object.assign(docForm, { title: d.title ?? '', category: d.category ?? '', keywords: d.keywords ?? '', content: d.content ?? '', enabled: d.enabled })
  docModal.value = true
}
const saveDoc = async () => {
  if (!docForm.title.trim() || !docForm.content.trim()) {
    message.error('Tiêu đề và nội dung là bắt buộc')
    return
  }
  try {
    await adminSaveDocument(editingDoc.value?.id ?? null, { ...docForm })
    message.success('Đã lưu tài liệu')
    docModal.value = false
    void refresh()
  } catch (e) {
    message.error(apiErrorMessage(e) ?? 'Lưu thất bại')
  }
}
const openCreateDoc = () => {
  editingDoc.value = null
  Object.assign(docForm, { title: '', category: '', keywords: '', content: '', enabled: true })
  docModal.value = true
}
const deleteDoc = (d: KnowledgeDoc) => {
  confirmRemove({
    title: 'Xóa tài liệu này?',
    content: 'Chatbot sẽ không tra được nội dung này nữa.',
    onOk: async () => {
      try {
        await adminDeleteDocument(d.id)
        message.success('Đã xóa tài liệu')
        void refresh()
      } catch (e) {
        message.error(apiErrorMessage(e) ?? 'Xóa thất bại')
      }
    },
  })
}
const handleUpload = async ({ file }: { file: { file?: File | null } }) => {
  if (file.file == null) {
    message.error('Không đọc được tệp tải lên')
    return false
  }
  try {
    const res = await adminUploadDocument(file.file, '', '', '')
    message.success(`Đã nạp tài liệu "${res.title}", đang chia ${res.chunkCount ?? 0} phần`)
    void refresh()
  } catch (e) {
    message.error(apiErrorMessage(e) ?? 'Tải lên thất bại')
  }
  return false
}
const reingest = async (id: number) => {
  try {
    await adminReingestDocument(id)
    message.success('Đã tạo lại')
    void refresh()
  } catch (e) {
    message.error(apiErrorMessage(e) ?? 'Tạo lại thất bại')
  }
}
const viewChunks = async (d: KnowledgeDoc) => {
  chunksDoc.value = d
  try {
    chunks.value = await adminGetDocumentChunks(d.id)
  } catch {
    chunks.value = []
  }
}

const docColumns: DataTableColumns<KnowledgeDoc> = [
  { title: 'Tiêu đề', key: 'title' },
  { title: 'Nhóm', key: 'category', width: 150, render: (row) => categoryLabel(row.category) },
  { title: 'Số phần', key: 'chunkCount', width: 80, render: (row) => h('span', { class: 'tabular-nums' }, row.chunkCount ?? 0) },
  { title: 'File', key: 'fileName', ellipsis: true, render: (row) => row.fileName ?? '—' },
  { title: 'Trạng thái', key: 'status', width: 120, render: (row) => statusLabel(row.status, row.enabled) },
  {
    title: 'Thao tác', key: 'actions', width: 260,
    render: (row) => h('div', { class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs' }, [
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-amber-700 hover:underline inline-flex items-center gap-1', onClick: () => openEditDoc(row) }, [h(NIcon, { size: 12 }, () => h(CreateOutline)), 'Sửa']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-amber-700 hover:underline inline-flex items-center gap-1', onClick: () => viewChunks(row) }, [h(NIcon, { size: 12 }, () => h(EyeOutline)), 'Xem']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-amber-700 hover:underline inline-flex items-center gap-1', onClick: () => reingest(row.id) }, [h(NIcon, { size: 12 }, () => h(RefreshOutline)), 'Tạo lại']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-red-600 hover:underline inline-flex items-center gap-1', onClick: () => deleteDoc(row) }, [h(NIcon, { size: 12 }, () => h(TrashOutline)), 'Xóa']),
    ]),
  },
]

const historyColumns: DataTableColumns<{ id: string; messages: ChatHistoryMessage[] }> = [
  {
    type: 'expand',
    width: 48,
    renderExpand: (row) => h('div', { class: 'rounded-xl bg-stone-50/80 p-3' }, row.messages.map((m) => h('div', { class: `flex ${m.sender === 'BOT' ? 'justify-start' : 'justify-end'}` }, [
      h('div', { class: 'max-w-[75%]' }, [
        h('div', { class: `rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.sender === 'BOT' ? 'rounded-bl-sm bg-white text-stone-700 ring-1 ring-stone-200' : 'rounded-br-sm bg-amber-600 text-white'}` }, m.content),
        h('p', { class: `mt-1 text-[11px] text-stone-400 ${m.sender === 'BOT' ? '' : 'text-right'}` }, `${m.sender === 'BOT' ? 'Bot' : 'User'} · ${formatTime(m.createdAt)}`),
      ]),
    ]))),
  },
  { title: 'Phiên', key: 'id', width: 130, render: (row) => h('code', { class: 'rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-500' }, row.id.slice(0, 8)) },
  {
    title: 'Khách', key: 'user', width: 190,
    render: (row) => {
      const lastUser = [...row.messages].reverse().find((m) => m.user)
      return lastUser?.user?.email
        ? h('span', { class: 'block truncate text-stone-600' }, lastUser.user.email)
        : h('span', { class: 'rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500' }, 'Ẩn danh')
    },
  },
  { title: 'Tin nhắn', key: 'count', width: 90, render: (row) => h('span', { class: 'tabular-nums text-stone-600' }, row.messages.length) },
  {
    title: 'Tin cuối', key: 'last',
    render: (row) => {
      const last = row.messages[row.messages.length - 1]!
      return h('span', { class: 'block max-w-md truncate text-stone-500' }, [
        h('span', { class: last.sender === 'BOT' ? 'text-amber-700' : 'text-stone-600' }, `${last.sender === 'BOT' ? 'Bot' : 'User'} · `),
        last.content,
      ])
    },
  },
  {
    title: 'Hoạt động cuối', key: 'time', width: 170,
    render: (row) => h('span', { class: 'tabular-nums text-stone-500' }, new Date(row.messages[row.messages.length - 1]!.createdAt).toLocaleString('vi-VN')),
  },
]
</script>

<template>
  <div>
    <div class="mb-3"><h1 class="text-2xl font-bold tracking-tight text-stone-900">Cấu hình chatbot</h1></div>

    <NAlert v-if="error" type="error" title="Không tải được dữ liệu chatbot" class="mb-6">
      <p class="text-sm">Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang.</p>
    </NAlert>
    <NAlert v-if="status && !status.available" type="warning" title="Chưa cấu hình trợ lý AI" class="mb-6">
      Trợ lý chưa dùng được vì máy chủ thiếu khóa API hoặc khóa đã bị nhà cung cấp từ chối. Kiểm tra biến <code>AI_API_KEY</code> trong tệp <code>.env</code> ở thư mục gốc rồi khởi động lại máy chủ.
    </NAlert>

    <PageCard class="mb-6">
      <div class="grid gap-6 p-5 sm:grid-cols-2">
        <div>
          <label for="ai-provider" class="block text-sm font-medium text-stone-700">Nhà cung cấp AI</label>
          <NSelect id="ai-provider" class="mt-2" :value="provider" :options="PROVIDER_OPTIONS" @update:value="onProviderChange" />
        </div>
        <div>
          <label for="ai-model" class="block text-sm font-medium text-stone-700">Tên mô hình</label>
          <NSelect id="ai-model" class="mt-2" :value="model" :options="modelOptions" @update:value="(v: string) => (model = v)" />
        </div>
        <div>
          <label for="max-suggestions" class="block text-sm font-medium text-stone-700">Số món gợi ý tối đa</label>
          <NInputNumber id="max-suggestions" class="mt-2 w-full" :min="1" :max="5" :value="maxSuggestions" @update:value="(v: number | null) => (maxSuggestions = v ?? 5)" />
        </div>
        <div class="sm:col-span-2">
          <label for="extra-rules" class="block text-sm font-medium text-stone-700">Quy tắc bổ sung</label>
          <NInput id="extra-rules" class="mt-2" type="textarea" :autosize="{ minRows: 3 }" :value="extraRules" placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..." @update:value="(v: string) => (extraRules = v)" />
        </div>
      </div>
      <div class="flex justify-end border-t border-stone-100 px-5 py-4">
        <NButton type="primary" :loading="savingSettings" @click="onSaveSettings">Lưu cài đặt</NButton>
      </div>
    </PageCard>

    <PageCard class="mb-6">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div class="flex items-center gap-1">
          <h3 class="font-semibold text-stone-800">Tài liệu ({documents.length})</h3>
          <NPopover trigger="click" placement="bottom-start" class="max-w-xs">
            <template #trigger>
              <button type="button" class="cursor-pointer border-0 bg-transparent p-1 text-stone-400 hover:text-stone-600" aria-label="Giải thích tài liệu">
                <NIcon :size="16"><InformationCircleOutline /></NIcon>
              </button>
            </template>
            <p class="max-w-xs text-xs leading-relaxed text-stone-700">
              Tài liệu là thông tin quán (giờ mở cửa, giao hàng, thanh toán...). Hệ thống tự chia mỗi tài liệu thành các phần nội dung để chatbot tìm theo nghĩa. Bấm <b>Xem</b> để xem các phần đã chia, <b>Tạo lại</b> để chia lại khi bạn sửa nội dung. Chỉ tải lên file, không thêm thủ công.
            </p>
          </NPopover>
        </div>
        <div class="flex items-center gap-2">
          <NButton size="small" @click="openCreateDoc">Thêm thủ công</NButton>
          <NUpload :show-file-list="false" accept=".pdf,.docx,.txt,.md" :custom-request="handleUpload">
            <NButton size="small">
              <template #icon><NIcon :size="14"><CloudUploadOutline /></NIcon></template>
              Tải lên file
            </NButton>
          </NUpload>
        </div>
      </div>
      <NDataTable :columns="docColumns" :data="documents" :row-key="(row: KnowledgeDoc) => row.id" :pagination="false" size="small" />
    </PageCard>

    <PageCard>
      <div class="border-b border-stone-100 px-5 py-4">
        <h3 class="font-semibold text-stone-800">Lịch sử hội thoại ({sessions.length})</h3>
      </div>
      <NDataTable :columns="historyColumns" :data="sessions" :row-key="(row: { id: string }) => row.id" :pagination="{ pageSize: 8 }" :scroll-x="720" size="small" />
    </PageCard>

    <FormModal :title="editingDoc ? 'Sửa tài liệu' : 'Thêm tài liệu'" :show="docModal" :on-close="() => { docModal = false }" :on-submit="saveDoc">
      <div class="space-y-4">
        <div>
          <label for="doc-title" class="block text-sm font-medium text-stone-700">Tiêu đề</label>
          <NInput id="doc-title" class="mt-1" :value="docForm.title" placeholder="Ví dụ: Giờ mở cửa" @update:value="(v: string) => { docForm.title = v }" />
        </div>
        <div>
          <label for="doc-cat" class="block text-sm font-medium text-stone-700">Nhóm</label>
          <NSelect id="doc-cat" class="mt-1" :value="docForm.category || undefined" :options="CATEGORY_OPTIONS" placeholder="Chọn nhóm" @update:value="(v: string) => { docForm.category = v }" />
        </div>
        <div>
          <label for="doc-keys" class="block text-sm font-medium text-stone-700">Từ khóa (cách nhau dấu phẩy)</label>
          <NInput id="doc-keys" class="mt-1" :value="docForm.keywords" placeholder="giờ mở cửa, mấy giờ đóng cửa" @update:value="(v: string) => { docForm.keywords = v }" />
        </div>
        <div>
          <label for="doc-content" class="block text-sm font-medium text-stone-700">Nội dung</label>
          <NInput id="doc-content" class="mt-1" type="textarea" :autosize="{ minRows: 4 }" :value="docForm.content" placeholder="Nội dung bot trả lời khi khách hỏi..." @update:value="(v: string) => { docForm.content = v }" />
        </div>
        <div>
          <span class="block text-sm font-medium text-stone-700">Trạng thái</span>
          <div class="mt-1 flex items-center gap-2">
            <NSwitch :value="docForm.enabled" @update:value="(v: boolean) => { docForm.enabled = v }" />
            <span class="text-sm text-stone-600">{{ docForm.enabled ? 'Cho phép chatbot tra cứu' : 'Chatbot sẽ bỏ qua' }}</span>
          </div>
        </div>
      </div>
    </FormModal>

    <NModal :show="chunksDoc !== null" preset="card" :title="chunksDoc ? `Nội dung đã chia của &quot;${chunksDoc.title}&quot;` : 'Nội dung đã chia'" :style="{ maxWidth: '36rem' }" @update:show="(v: boolean) => !v && (chunksDoc = null)">
      <div class="max-h-[400px] space-y-2 overflow-auto">
        <p v-if="chunks.length === 0" class="text-sm text-stone-500">Chưa có phần nội dung (có thể chưa tạo lại sau khi sửa).</p>
        <div v-for="c in chunks" :key="c.id" class="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          <p class="mb-1 text-xs font-semibold text-stone-500">Phần {{ c.chunkIndex + 1 }}</p>
          <p class="whitespace-pre-wrap">{{ c.content }}</p>
        </div>
      </div>
    </NModal>
  </div>
</template>
