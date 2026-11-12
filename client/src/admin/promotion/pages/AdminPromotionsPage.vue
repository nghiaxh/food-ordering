<script setup lang="ts">
import { computed, h, reactive, ref, watchEffect } from 'vue'
import {
  NButton,
  NDataTable,
  NDatePicker,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NForm,
  NFormItem,
  NEmpty,
  type DataTableColumns,
} from 'naive-ui'
import { adminDeletePromotion, adminGetPromotions, adminSavePromotion } from '@/admin/promotion/api'
import { getCategories, getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import type { Promotion } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { confirmRemove, runAndMessage } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import TableSkeleton from '@/admin/components/TableSkeleton.vue'
import FormModal from '@/components/FormModal.vue'
import { message } from '@/shared/api/message'

const SCOPES = [
  { value: 'GLOBAL', label: 'Toàn thực đơn' },
  { value: 'CATEGORY', label: 'Theo danh mục' },
  { value: 'FOOD', label: 'Theo món' },
]
const TYPES = [
  { value: 'PERCENT', label: 'Phần trăm' },
  { value: 'FIXED', label: 'Số tiền cố định' },
]

const discountLabel = (p: Promotion): string =>
  p.discountType === 'PERCENT'
    ? `${p.discountValue}%${p.maxDiscount ? ` (tối đa ${formatVND(p.maxDiscount)})` : ''}`
    : formatVND(p.discountValue)

const { data: promotions, loading, error, refresh } = useAsyncData(() => adminGetPromotions(), () => [])
watchEffect(() => { if (error.value) message.error('Không tải được danh sách khuyến mãi') })
const { data: categories } = useAsyncData((signal) => getCategories(signal), () => [])
const { data: foods } = useAsyncData((signal) => getFoods(undefined, signal), () => [])
const { run: save, pending: saving } = useAsyncAction(
  (payload: { id: number | null; data: Record<string, unknown> }) => adminSavePromotion(payload.id, payload.data),
)
const { run: removePromotion } = useAsyncAction((id: number) => adminDeletePromotion(id))

const modal = ref(false)
const editing = ref<Promotion | null>(null)
const form = reactive({
  name: '',
  description: '',
  discountType: 'PERCENT' as Promotion['discountType'],
  discountValue: 10,
  maxDiscount: null as number | null,
  scope: 'GLOBAL' as Promotion['scope'],
  targetIds: [] as number[],
  range: null as [number, number] | null,
  daysOfWeek: '',
  active: true,
  priority: 0,
  usageLimit: null as number | null,
  randomCount: 0,
})
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const categoryOptions = computed(() => (categories.value ?? []).map((c) => ({ label: c.name, value: c.id })))
const foodOptions = computed(() => (foods.value ?? []).map((f) => ({ label: f.name, value: f.id })))
const targetOptions = computed(() => (form.scope === 'CATEGORY' ? categoryOptions.value : foodOptions.value))

const openCreate = () => {
  editing.value = null
  Object.assign(form, { name: '', description: '', discountType: 'PERCENT', discountValue: 10, maxDiscount: null, scope: 'GLOBAL', targetIds: [], range: null, daysOfWeek: '', active: true, priority: 0, usageLimit: null, randomCount: 0 })
  modal.value = true
}
const openEdit = (p: Promotion) => {
  editing.value = p
  Object.assign(form, {
    name: p.name,
    description: p.description ?? '',
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscount: p.maxDiscount ?? null,
    scope: p.scope,
    targetIds: p.targetIds ?? [],
    range: [new Date(p.startsAt).getTime(), new Date(p.endsAt).getTime()],
    daysOfWeek: p.daysOfWeek ?? '',
    active: p.active,
    priority: p.priority,
    usageLimit: p.usageLimit ?? null,
    randomCount: p.randomCount ?? 0,
  })
  modal.value = true
}

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  if (!form.range) {
    message.warning('Chọn thời gian bắt đầu và kết thúc')
    return
  }
  const data: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    discountType: form.discountType,
    discountValue: form.discountValue,
    maxDiscount: form.maxDiscount ?? null,
    scope: form.scope,
    targetIds: form.targetIds ?? [],
    // zod coerce.date o server doc duoc ISO string ke ca co mui gio.
    startsAt: new Date(form.range[0]).toISOString(),
    endsAt: new Date(form.range[1]).toISOString(),
    daysOfWeek: form.daysOfWeek.trim() || null,
    active: form.active,
    priority: form.priority,
    usageLimit: form.usageLimit ?? null,
    randomCount: form.randomCount ?? 0,
  }
  const res = await save({ id: editing.value?.id ?? null, data })
  await runAndMessage(res, {
    success: 'Đã lưu khuyến mãi',
    fallback: 'Lưu khuyến mãi thất bại',
    onSuccess: () => {
      modal.value = false
      editing.value = null
      void refresh()
    },
  })
}

const doRemove = async (p: Promotion) => {
  const res = await removePromotion(p.id)
  await runAndMessage(res, {
    success: 'Đã xóa khuyến mãi',
    fallback: 'Không xóa được khuyến mãi này',
    onSuccess: () => void refresh(),
  })
}

const columns: DataTableColumns<Promotion> = [
  { title: 'Tên', key: 'name' },
  { title: 'Mức giảm', key: 'discount', render: (_row) => discountLabel(_row) },
  { title: 'Phạm vi', key: 'scope', render: (row) => SCOPES.find((s) => s.value === row.scope)?.label ?? row.scope },
  {
    title: 'Hiệu lực', key: 'range',
    render: (row) => h('span', { class: 'text-stone-500' },
      `${new Date(row.startsAt).toLocaleDateString('vi-VN')} – ${new Date(row.endsAt).toLocaleDateString('vi-VN')}`),
  },
  { title: 'Trạng thái', key: 'active', render: (row) => h('span', { class: row.active ? 'font-medium text-emerald-700' : 'text-stone-400' }, row.active ? 'Đang chạy' : 'Tạm dừng') },
  {
    title: 'Thao tác', key: 'actions', width: 150,
    render: (row) => h('div', { class: 'flex gap-2' }, [
      h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => 'Sửa'),
      h(NButton, {
        size: 'small', type: 'error', ghost: true,
        onClick: () => confirmRemove({ title: `Xóa khuyến mãi "${row.name}"?`, onOk: () => doRemove(row) }),
      }, () => 'Xóa'),
    ]),
  },
]
</script>

<template>
  <div>
    <PageHeader title="Khuyến mãi"><template #extra>
      <NButton type="primary" @click="openCreate">Thêm khuyến mãi</NButton>
    </template></PageHeader>

    <PageCard>
      <TableSkeleton v-if="loading && !promotions" />
      <NEmpty v-else-if="(promotions ?? []).length === 0" class="py-16" description="Chưa có khuyến mãi nào." />
      <NDataTable v-else :columns="columns" :data="promotions ?? []" :row-key="(row: Promotion) => row.id" :pagination="{ pageSize: 10 }" :scroll-x="900" size="small" />
    </PageCard>

    <FormModal :title="editing ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'" :show="modal" :saving="saving" :on-close="() => { modal = false }" :on-submit="submit">
      <NForm ref="formRef" :model="form" :show-require-mark="false" class="mt-4">
        <NFormItem label="Tên chương trình" path="name" :rule="[{ required: true, message: 'Nhập tên chương trình', trigger: ['blur', 'input'] }]">
          <NInput v-model:value="form.name" size="medium" />
        </NFormItem>
        <NFormItem label="Mô tả hiển thị cho khách" path="description">
          <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 2 }" :maxlength="500" show-count size="medium" />
        </NFormItem>

        <div class="grid gap-x-3 sm:grid-cols-2">
          <NFormItem label="Kiểu giảm" path="discountType" :rule="[{ required: true }]">
            <NSelect v-model:value="form.discountType" :options="TYPES" size="medium" />
          </NFormItem>
          <NFormItem label="Giá trị" path="discountValue" :rule="[{ required: true, message: 'Nhập giá trị giảm', trigger: ['blur', 'input'] }]">
            <NInputNumber v-model:value="form.discountValue" :min="0" class="w-full" size="medium" />
          </NFormItem>
          <NFormItem label="Giảm tối đa (theo %)" path="maxDiscount">
            <NInputNumber v-model:value="form.maxDiscount" :min="0" class="w-full" placeholder="Bỏ trống nếu không giới hạn" size="medium" />
          </NFormItem>
        </div>

        <div class="grid gap-x-3 sm:grid-cols-2">
          <NFormItem label="Phạm vi" path="scope" :rule="[{ required: true }]">
            <NSelect v-model:value="form.scope" :options="SCOPES" size="medium" />
          </NFormItem>
          <NFormItem
            v-if="form.scope !== 'GLOBAL'"
            :label="form.scope === 'CATEGORY' ? 'Danh mục áp dụng' : 'Món áp dụng'"
            path="targetIds"
            :rule="{ type: 'array', required: true, message: 'Chọn ít nhất một mục áp dụng', trigger: ['blur', 'change'] }"
          >
            <NSelect v-model:value="form.targetIds" multiple clearable :placeholder="`Chọn ${form.scope === 'CATEGORY' ? 'danh mục' : 'món'}`" :options="targetOptions" size="medium" />
            <template #feedback>
              <span class="text-xs text-stone-400">Chọn ít nhất một mục được giảm.</span>
            </template>
          </NFormItem>
        </div>

        <div class="grid gap-x-3 sm:grid-cols-2">
          <NFormItem label="Thời gian" path="range" :rule="[{ required: true, message: 'Chọn thời điểm', trigger: 'change' }]" class="sm:col-span-2">
            <NDatePicker v-model:value="form.range" type="datetimerange" class="w-full" size="medium" />
          </NFormItem>
        </div>

        <NFormItem label="Ngày trong tuần" path="daysOfWeek">
          <NInput v-model:value="form.daysOfWeek" placeholder="SAT,SUN (bỏ trống = mọi ngày)" size="medium" />
        </NFormItem>

        <div class="grid gap-x-3 sm:grid-cols-3">
          <NFormItem label="Ưu tiên" path="priority">
            <NInputNumber v-model:value="form.priority" class="w-full" size="medium" />
          </NFormItem>
          <NFormItem label="Giới hạn lượt dùng" path="usageLimit">
            <NInputNumber v-model:value="form.usageLimit" :min="0" class="w-full" placeholder="Không giới hạn" size="medium" />
          </NFormItem>
          <NFormItem label="Số món ngẫu nhiên mỗi ngày" path="randomCount">
            <NInputNumber v-model:value="form.randomCount" :min="0" class="w-full" size="medium" />
            <template #feedback>
              <span class="text-xs text-stone-400">0 = áp cho mọi món khớp phạm vi.</span>
            </template>
          </NFormItem>
        </div>

        <NFormItem label="Đang chạy" path="active">
          <NSwitch v-model:value="form.active" />
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
