<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopover,
  NProgress,
  NSelect,
  NSwitch,
  NTag,
  NUpload,
  NUploadDragger,
  type DataTableColumns,
} from 'naive-ui'
import {
  CloudUploadOutline,
  InformationCircleOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import {
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
import type { ChatbotStatus, KnowledgeChunkView, KnowledgeDoc } from '@/shared/types'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import { confirmRemove } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import FormModal from '@/components/FormModal.vue'

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
  if (status === 'EMBEDDING') return 'Đang embed'
  if (status === 'FAILED') return 'Lỗi'
  return enabled ? 'Sẵn sàng' : 'Tạm ngừng'
}
const categoryLabel = (v?: string | null): string =>
  CATEGORY_OPTIONS.find((o) => o.value === v)?.label ?? (v || 'Khác')
const maxSuggestions = ref(5)
const extraRules = ref('')

const docModal = ref(false)
const editingDoc = ref<KnowledgeDoc | null>(null)
const docForm = reactive({ title: '', category: '', keywords: '', content: '', enabled: true })
const chunksDoc = ref<KnowledgeDoc | null>(null)
const chunks = ref<KnowledgeChunkView[]>([])

const uploadModal = ref(false)
const uploading = ref(false)
const uploadPercent = ref(0)
const uploadName = ref('')

const { data, loading, error, refresh } = useAsyncData(
  () => Promise.all([adminGetSettings(), getChatbotStatus(), adminGetDocuments()]),
  () => [],
)

watch(data, (value) => {
  if (!value) return
  const settings = Object.fromEntries(value[0].map((s) => [s.settingKey, s.settingValue]))
  maxSuggestions.value = Math.min(5, Math.max(1, Number(settings.max_suggestions ?? 5) || 5))
  extraRules.value = settings.extra_rules ?? ''
}, { immediate: true })

const status = computed<ChatbotStatus | null>(() => (data.value?.[1] as ChatbotStatus | undefined) ?? null)
const documents = computed(() => data.value?.[2] ?? [])

const { run: saveSettings, pending: savingSettings } = useAsyncAction(() =>
  Promise.all([
    adminSaveSetting('max_suggestions', String(maxSuggestions.value)),
    adminSaveSetting('extra_rules', extraRules.value),
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
  const raw = file.file
  if (!raw) {
    message.error('Không đọc được tệp tải lên')
    return
  }
  if (raw.size > 10 * 1024 * 1024) {
    message.error('Tệp vượt quá 10 MB')
    return
  }
  uploadName.value = raw.name
  uploadPercent.value = 0
  uploading.value = true
  try {
    const res = await adminUploadDocument(raw, '', '', '', (percent) => {
      uploadPercent.value = percent
    })
    uploadPercent.value = 100
    message.success(`Đã nạp tài liệu "${res.title}"`)
    uploadModal.value = false
    void refresh()
  } catch (e) {
    message.error(apiErrorMessage(e) ?? 'Tải lên thất bại')
  } finally {
    uploading.value = false
  }
}
const reingest = async (id: number) => {
  try {
    await adminReingestDocument(id)
    message.success('Đã cập nhật tài liệu')
    void refresh()
  } catch (e) {
    message.error(apiErrorMessage(e) ?? 'Cập nhật thất bại')
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
    title: 'Tiêu đề',
    key: 'title',
    render: (row) => h('span', { class: 'font-medium text-stone-800' }, row.title),
  },
  {
    title: 'Nhóm',
    key: 'category',
    width: 140,
    render: (row) =>
      h(
        NTag,
        { round: false, size: 'small', bordered: false, class: 'bg-stone-100 text-stone-600' },
        () => categoryLabel(row.category),
      ),
  },
  {
    title: 'Trạng thái',
    key: 'status',
    width: 120,
    render: (row) => {
      const dot = row.status === 'PENDING' || row.status === 'EMBEDDING'
        ? 'bg-amber-500'
        : row.status === 'FAILED' || !row.enabled
          ? 'bg-stone-400'
          : 'bg-emerald-500'
      return h('span', { class: 'inline-flex items-center gap-1.5 text-xs text-stone-600' }, [
        h('span', { class: `h-1.5 w-1.5 rounded-full ${dot}` }),
        statusLabel(row.status, row.enabled),
      ])
    },
  },
  {
    title: 'Thao tác',
    key: 'actions',
    width: 210,
    render: (row) =>
      h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
        h(NButton, { size: 'tiny', onClick: () => openEditDoc(row) }, () => 'Sửa'),
        h(NButton, { size: 'tiny', onClick: () => viewChunks(row) }, () => 'Xem'),
        h(NButton, { size: 'tiny', onClick: () => reingest(row.id) }, () => 'Cập nhật'),
        h(NButton, { size: 'tiny', type: 'error', ghost: true, onClick: () => deleteDoc(row) }, () => 'Xóa'),
      ]),
  },
]
</script>

<template>
  <div>
    <PageHeader title="Cấu hình chatbot">
      <template #extra>
        <NButton size="small" :loading="loading" @click="refresh">
          <template #icon><NIcon :size="14"><RefreshOutline /></NIcon></template>
          Tải lại
        </NButton>
      </template>
    </PageHeader>

    <NAlert v-if="error" type="error" title="Không tải được dữ liệu chatbot" class="mb-4">
      <p class="text-sm">Đã có lỗi khi kết nối máy chủ. Kiểm tra kết nối rồi tải lại trang.</p>
    </NAlert>
    <NAlert v-if="status && !status.available" type="warning" title="Chưa cấu hình trợ lý AI" class="mb-4">
      Trợ lý chưa dùng được vì máy chủ thiếu khóa API hoặc mọi khóa đã bị nhà cung cấp từ chối. Kiểm tra biến <code>AI_API_KEYS</code> (hoặc <code>AI_API_KEY</code>) trong tệp <code>.env</code> ở thư mục gốc rồi khởi động lại máy chủ.
    </NAlert>

    <PageCard class="mb-4">
      <div class="p-4">
        <NForm :show-feedback="false" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-1">
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
              <div class="flex items-center justify-end">
                <NButton v-if="extraRules.trim()" size="tiny" quaternary type="default" @click="extraRules = ''">
                  Xoá quy tắc
                </NButton>
              </div>
            </div>
          </NFormItem>
          <div class="flex justify-end">
            <NButton type="primary" size="small" :loading="savingSettings" @click="onSaveSettings">
              Lưu cài đặt
            </NButton>
          </div>
        </NForm>
      </div>

    </PageCard>

    <PageCard class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-stone-800">Tài liệu</span>
          <NTag :round="false" size="small" :bordered="false" class="bg-stone-100 font-medium text-stone-600">
            {{ documents.length }} tài liệu
          </NTag>
          <NPopover trigger="click" placement="bottom-start" class="max-w-xs">
            <template #trigger>
              <NButton text size="tiny" class="text-stone-400 hover:text-stone-600" aria-label="Giải thích tài liệu">
                <template #icon><NIcon :size="16"><InformationCircleOutline /></NIcon></template>
              </NButton>
            </template>
            <p class="max-w-xs text-xs leading-relaxed text-stone-700">
              Tài liệu là thông tin quán (giờ mở cửa, giao hàng, thanh toán...). Hệ thống tự chia mỗi tài liệu thành các phần nội dung để chatbot tìm theo nghĩa. Bấm <b>Xem</b> để xem các phần đã chia, <b>Cập nhật</b> để chia lại khi nội dung thay đổi.
            </p>
          </NPopover>
        </div>
        <NButton size="small" type="primary" secondary @click="uploadModal = true">
          Tải lên tệp
        </NButton>
      </div>

      <NEmpty v-if="documents.length === 0" class="py-10" description="Chưa có tài liệu tri thức nào." />
      <NDataTable
        v-else
        :columns="docColumns"
        :data="documents"
        :row-key="(row: KnowledgeDoc) => row.id"
        :pagination="false"
        size="small"
      />
    </PageCard>

    <FormModal :title="editingDoc?.title ?? 'Sửa tài liệu'" :show="docModal" :on-close="() => { docModal = false }" :on-submit="saveDoc">
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

    <NModal v-model:show="uploadModal" preset="card" title="Tải lên tài liệu" :style="{ maxWidth: '32rem' }">
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-stone-500">
          Chấp nhận PDF, DOCX, TXT, MD, dung lượng tối đa 10 MB. Tài liệu sẽ được tự động chia phần và tạo vector để chatbot tra cứu.
        </p>
        <NUpload v-if="!uploading" :show-file-list="false" accept=".pdf,.docx,.txt,.md" :custom-request="handleUpload">
          <NUploadDragger>
            <div class="px-4 py-8 text-center">
              <NIcon :size="28" class="text-stone-400"><CloudUploadOutline /></NIcon>
              <p class="mt-2 text-sm text-stone-600">Kéo thả tệp vào đây hoặc bấm để chọn</p>
            </div>
          </NUploadDragger>
        </NUpload>
        <div v-else class="space-y-2">
          <p class="truncate text-sm text-stone-700">{{ uploadName }}</p>
          <NProgress type="line" :percentage="uploadPercent" :height="8" :show-indicator="false" />
          <p class="text-xs text-stone-500">{{ uploadPercent >= 100 ? 'Đang xử lý nội dung...' : 'Đang tải lên...' }}</p>
        </div>
      </div>
    </NModal>

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
