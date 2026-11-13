<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopover,
  NSelect,
  NSwitch,
  NTag,
  NUpload,
  type DataTableColumns,
} from 'naive-ui'
import {
  CloudUploadOutline,
  InformationCircleOutline,
  EyeOutline,
  CreateOutline,
  RefreshOutline,
  TrashOutline,
  AddOutline,
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
import PageHeader from '@/admin/components/PageHeader.vue'
import FormModal from '@/components/FormModal.vue'

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

const { data, loading, error, refresh } = useAsyncData(
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
  {
    title: 'Thao tác', key: 'actions', width: 260,
    render: (row) => h('div', { class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs' }, [
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-orange-700 hover:underline inline-flex items-center gap-1', onClick: () => openEditDoc(row) }, [h(NIcon, { size: 12 }, () => h(CreateOutline)), 'Sửa']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-orange-700 hover:underline inline-flex items-center gap-1', onClick: () => viewChunks(row) }, [h(NIcon, { size: 12 }, () => h(EyeOutline)), 'Xem']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-orange-700 hover:underline inline-flex items-center gap-1', onClick: () => reingest(row.id) }, [h(NIcon, { size: 12 }, () => h(RefreshOutline)), 'Tạo lại']),
      h('button', { class: 'cursor-pointer border-0 bg-transparent p-0 font-medium text-red-600 hover:underline inline-flex items-center gap-1', onClick: () => deleteDoc(row) }, [h(NIcon, { size: 12 }, () => h(TrashOutline)), 'Xóa']),
    ]),
  },
]

const historyColumns: DataTableColumns<{ id: string; messages: ChatHistoryMessage[] }> = [
  {
    type: 'expand',
    width: 48,
    renderExpand: (row) => h('div', { class: 'rounded-lg bg-stone-50/80 p-2.5' }, row.messages.map((m) => h('div', { class: `flex ${m.sender === 'BOT' ? 'justify-start' : 'justify-end'}` }, [
      h('div', { class: 'max-w-[75%]' }, [
        h('div', { class: `rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.sender === 'BOT' ? 'rounded-bl-sm bg-white text-stone-700 ring-1 ring-stone-200' : 'rounded-br-sm bg-orange-600 text-white'}` }, m.content),
        h('p', { class: `mt-1 text-[11px] text-stone-400 ${m.sender === 'BOT' ? '' : 'text-right'}` }, `${m.sender === 'BOT' ? 'Bot' : 'User'} · ${formatTime(m.createdAt)}`),
      ]),
    ]))),
  },
  {
    title: 'Khách hàng',
    key: 'user',
    width: 200,
    render: (row) => {
      const lastUser = [...row.messages].reverse().find((m) => m.user)
      return lastUser?.user?.email
        ? h('span', { class: 'block truncate font-medium text-stone-700' }, lastUser.user.email)
        : h(
            NTag,
            { round: false, size: 'small', bordered: false, class: 'bg-stone-100 text-stone-500' },
            () => 'Ẩn danh',
          )
    },
  },
  {
    title: 'Số tin',
    key: 'count',
    width: 80,
    render: (row) => h('span', { class: 'tabular-nums text-stone-600' }, row.messages.length),
  },
  {
    title: 'Tin nhắn cuối',
    key: 'last',
    render: (row) => {
      const last = row.messages[row.messages.length - 1]!
      return h('span', { class: 'block max-w-md truncate text-stone-500' }, [
        h('span', { class: last.sender === 'BOT' ? 'text-orange-700' : 'text-stone-600' }, `${last.sender === 'BOT' ? 'Bot' : 'User'} · `),
        last.content,
      ])
    },
  },
  {
    title: 'Thời gian',
    key: 'time',
    width: 160,
    render: (row) =>
      h(
        'span',
        { class: 'tabular-nums text-xs text-stone-500' },
        new Date(row.messages[row.messages.length - 1]!.createdAt).toLocaleString('vi-VN'),
      ),
  },
]
</script>

<template>
  <div>
    <PageHeader title="Cấu hình chatbot" />

    <NAlert v-if="error" type="error" title="Không tải được dữ liệu chatbot" class="mb-4">
      <p class="text-sm">Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang.</p>
    </NAlert>
    <NAlert v-if="status && !status.available" type="warning" title="Chưa cấu hình trợ lý AI" class="mb-4">
      Trợ lý chưa dùng được vì máy chủ thiếu khóa API hoặc khóa đã bị nhà cung cấp từ chối. Kiểm tra biến <code>AI_API_KEY</code> trong tệp <code>.env</code> ở thư mục gốc rồi khởi động lại máy chủ.
    </NAlert>

    <PageCard class="mb-4">
      <div class="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label for="ai-provider" class="block text-sm font-medium text-stone-700">Nhà cung cấp AI</label>
          <NSelect id="ai-provider" class="mt-2" :value="provider" :options="PROVIDER_OPTIONS" @update:value="onProviderChange" />
        </div>
        <div>
          <label for="ai-model" class="block text-sm font-medium text-stone-700">Tên mô hình</label>
          <NSelect id="ai-model" class="mt-2" :value="model" :options="modelOptions" @update:value="(v: string) => (model = v)" />
        </div>
      </template>
      <template #header-extra>
        <NButton type="primary" size="small" :loading="savingSettings" @click="onSaveSettings">
          Lưu cài đặt
        </NButton>
      </template>

      <NForm :show-feedback="false" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-3">
          <NFormItem label="Nhà cung cấp AI">
            <NSelect
              :value="provider"
              :options="PROVIDER_OPTIONS"
              size="small"
              @update:value="onProviderChange"
            />
          </NFormItem>
          <NFormItem label="Tên mô hình">
            <NSelect
              :value="model"
              :options="modelOptions"
              filterable
              tag
              size="small"
              placeholder="Chọn hoặc nhập tên mô hình"
              @update:value="(v: string) => (model = v)"
            />
          </NFormItem>
          <NFormItem label="Số món gợi ý tối đa">
            <NInputNumber
              :value="maxSuggestions"
              :min="1"
              :max="5"
              size="small"
              class="w-full"
              @update:value="(v: number | null) => (maxSuggestions = v ?? 5)"
            />
          </NFormItem>
        </div>

        <NFormItem label="Quy tắc bổ sung (System Prompt)">
          <div class="w-full space-y-1.5">
            <NInput
              :value="extraRules"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="Ví dụ: Ưu tiên gợi ý món bán chạy, nhắc nhở khách về thành phần dị ứng nếu được hỏi..."
              size="small"
              @update:value="(v: string) => (extraRules = v)"
            />
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
              <span>Quy tắc được nối vào prompt hệ thống của AI. Để trống nếu muốn xoá bỏ quy tắc.</span>
              <NButton v-if="extraRules.trim()" size="tiny" quaternary type="default" @click="extraRules = ''">
                Xoá quy tắc
              </NButton>
            </div>
          </div>
        </NFormItem>
      </NForm>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <div class="flex flex-wrap items-center gap-1.5">
            <span>Cấu hình hiện tại:</span>
            <span class="font-medium text-stone-700">{{ provider === 'openai' ? 'OpenAI' : 'Google Gemini' }}</span>
            <span>·</span>
            <span class="font-mono text-stone-700">{{ model || 'Mặc định' }}</span>
            <span>·</span>
            <span>Tối đa {{ maxSuggestions }} món/lượt</span>
          </div>
          <NButton type="primary" size="small" :loading="savingSettings" @click="onSaveSettings">
            Lưu cài đặt
          </NButton>
        </div>
      </div>
      <div class="flex justify-end border-t border-stone-100 px-4 py-3">
        <NButton type="primary" size="small" :loading="savingSettings" @click="onSaveSettings">Lưu cài đặt</NButton>
      </div>
    </PageCard>

    <PageCard class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div class="flex items-center gap-1">
          <h3 class="font-semibold text-stone-800">Tài liệu ({documents.length})</h3>
          <NPopover trigger="click" placement="bottom-start" class="max-w-xs">
            <template #trigger>
              <NButton text size="tiny" class="text-stone-400 hover:text-stone-600" aria-label="Giải thích tài liệu">
                <template #icon><NIcon :size="16"><InformationCircleOutline /></NIcon></template>
              </NButton>
            </template>
            <p class="max-w-xs text-xs leading-relaxed text-stone-700">
              Tài liệu là thông tin quán (giờ mở cửa, giao hàng, thanh toán...). Hệ thống tự chia mỗi tài liệu thành các phần nội dung để chatbot tìm theo nghĩa. Bấm <b>Xem</b> để xem các phần đã chia, <b>Tạo lại</b> để chia lại khi bạn sửa nội dung.
            </p>
          </NPopover>
        </div>
      </template>
      <template #header-extra>
        <div class="flex items-center gap-2">
          <NButton size="small" @click="openCreateDoc">
            <template #icon><NIcon :size="14"><AddOutline /></NIcon></template>
            Thêm thủ công
          </NButton>
          <NUpload :show-file-list="false" accept=".pdf,.docx,.txt,.md" :custom-request="handleUpload">
            <NButton size="small" type="primary" secondary>
              <template #icon><NIcon :size="14"><CloudUploadOutline /></NIcon></template>
              Tải lên tệp
            </NButton>
          </NUpload>
        </div>
      </template>

    <PageCard>
      <div class="border-b border-stone-100 px-4 py-3">
        <h3 class="font-semibold text-stone-800">Lịch sử hội thoại ({sessions.length})</h3>
      </div>
      <NDataTable :columns="historyColumns" :data="sessions" :row-key="(row: { id: string }) => row.id" :pagination="{ pageSize: 8 }" :scroll-x="720" size="small" />
    </PageCard>

    <NCard
      size="small"
      :bordered="false"
      class="rounded-2xl shadow-sm ring-1 ring-stone-200/70"
      :segmented="{ content: true }"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold text-stone-800">Lịch sử hội thoại</span>
          <NTag :round="false" size="small" :bordered="false" class="bg-stone-100 font-medium text-stone-600">
            {{ sessions.length }} phiên
          </NTag>
        </div>
      </template>

      <NEmpty v-if="sessions.length === 0" class="py-10" description="Chưa có phiên trò chuyện nào." />
      <NDataTable
        v-else
        :columns="historyColumns"
        :data="sessions"
        :row-key="(row: { id: string }) => row.id"
        :pagination="{ pageSize: 8 }"
        :scroll-x="720"
        size="small"
      />
    </NCard>

    <FormModal :title="editingDoc ? 'Sửa tài liệu' : 'Thêm tài liệu'" :show="docModal" :on-close="() => { docModal = false }" :on-submit="saveDoc">
      <NForm :show-feedback="false" class="space-y-3 pt-1">
        <NFormItem label="Tiêu đề tài liệu">
          <NInput :value="docForm.title" placeholder="Ví dụ: Giờ mở cửa" size="small" @update:value="(v: string) => { docForm.title = v }" />
        </NFormItem>
        <div class="grid gap-3 sm:grid-cols-2">
          <NFormItem label="Nhóm chủ đề">
            <NSelect :value="docForm.category || undefined" :options="CATEGORY_OPTIONS" placeholder="Chọn nhóm" size="small" @update:value="(v: string) => { docForm.category = v }" />
          </NFormItem>
          <NFormItem label="Từ khóa (cách nhau dấu phẩy)">
            <NInput :value="docForm.keywords" placeholder="giờ mở cửa, mấy giờ đóng cửa" size="small" @update:value="(v: string) => { docForm.keywords = v }" />
          </NFormItem>
        </div>
        <NFormItem label="Nội dung">
          <NInput :value="docForm.content" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="Nội dung bot trả lời khi khách hỏi..." size="small" @update:value="(v: string) => { docForm.content = v }" />
        </NFormItem>
        <NFormItem label="Trạng thái">
          <div class="flex items-center gap-2">
            <NSwitch :value="docForm.enabled" size="small" @update:value="(v: boolean) => { docForm.enabled = v }" />
            <span class="text-xs text-stone-600">{{ docForm.enabled ? 'Cho phép chatbot tra cứu' : 'Chatbot sẽ bỏ qua' }}</span>
          </div>
        </NFormItem>
      </NForm>
    </FormModal>

    <NModal :show="chunksDoc !== null" preset="card" :title="chunksDoc ? `Nội dung đã chia của &quot;${chunksDoc.title}&quot;` : 'Nội dung đã chia'" :style="{ maxWidth: '38rem' }" @update:show="(v: boolean) => !v && (chunksDoc = null)">
      <div class="max-h-[420px] space-y-2.5 overflow-auto pr-1">
        <p v-if="chunks.length === 0" class="text-sm text-stone-500">Chưa có phần nội dung (có thể chưa tạo lại sau khi sửa).</p>
        <div v-for="c in chunks" :key="c.id" class="rounded-xl border border-stone-200/70 bg-stone-50/70 p-3 text-sm text-stone-700">
          <div class="mb-1.5 flex items-center justify-between">
            <NTag :round="false" size="small" :bordered="false" class="bg-stone-200/70 font-medium text-stone-600">Phần {{ c.chunkIndex + 1 }}</NTag>
          </div>
          <p class="whitespace-pre-wrap leading-relaxed">{{ c.content }}</p>
        </div>
      </div>
    </NModal>
  </div>
</template>
