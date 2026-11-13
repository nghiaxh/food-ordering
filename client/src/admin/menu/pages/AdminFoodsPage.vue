<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import {
  NButton,
  NCheckbox,
  NDataTable,
  NInput,
  NInputNumber,
  NSelect,
  NForm,
  NFormItem,
  NIcon,
  NEmpty,
  NTag,
  type DataTableColumns,
} from 'naive-ui'
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { adminDeleteFood, adminSaveFood } from '@/admin/menu/api'
import { getCategories, getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import useBusySet from '@/composables/useBusySet'
import type { Food } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { SPICY_LEVELS } from '@/shared/utils/food-tags'
import { confirmRemove, runAndMessage } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import StatusDot from '@/admin/components/StatusDot.vue'
import TableSkeleton from '@/admin/components/TableSkeleton.vue'
import ImageField from '@/admin/components/ImageField.vue'
import FormModal from '@/components/FormModal.vue'

const search = ref('')
const catFilter = ref<number | undefined>(undefined)
const statusFilter = ref<'all' | 'available' | 'hidden'>('all')
const modal = ref(false)
const editing = ref<Food | null>(null)
const { busyIds, mark } = useBusySet()

const form = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  price: 0,
  servingSize: 1,
  spicyLevel: 0,
  description: '',
  ingredients: '',
  dietaryTags: '',
  allergens: '',
  imageUrl: '',
  available: true,
})
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const { data, loading, refresh } = useAsyncData((signal) => getFoods(undefined, signal), () => [])
const { data: cats } = useAsyncData((signal) => getCategories(signal), () => [])
const { run: saveFood, pending: saving } = useAsyncAction(
  (payload: Record<string, unknown>) => adminSaveFood(editing.value?.id ?? null, payload),
)
const { run: deleteFood } = useAsyncAction((id: number) => adminDeleteFood(id))

const rows = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return (data.value ?? []).filter((f) => {
    if (kw && !f.name.toLowerCase().includes(kw) && !(f.category?.name ?? '').toLowerCase().includes(kw)) {
      return false
    }
    if (catFilter.value !== undefined && f.category?.id !== catFilter.value) return false
    if (statusFilter.value === 'available' && !f.available) return false
    if (statusFilter.value === 'hidden' && f.available) return false
    return true
  })
})

const openCreate = () => {
  editing.value = null
  Object.assign(form, { name: '', categoryId: undefined, price: 0, servingSize: 1, spicyLevel: 0, description: '', ingredients: '', dietaryTags: '', allergens: '', imageUrl: '', available: true })
  modal.value = true
}

const openEdit = (f: Food) => {
  editing.value = f
  // Chi pick field form can: truyen ...f se keo theo id, category, discountLabel... vao payload
  // gui API, nen luon co gia tri lai do server tu tim theo categoryId.
  Object.assign(form, {
    name: f.name,
    categoryId: f.category?.id ?? undefined,
    price: f.price,
    servingSize: f.servingSize,
    spicyLevel: f.spicyLevel,
    description: f.description,
    ingredients: f.ingredients,
    dietaryTags: f.dietaryTags,
    allergens: f.allergens,
    imageUrl: f.imageUrl ?? '',
    available: f.available,
  })
  modal.value = true
}

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const res = await saveFood({
    ...form,
    imageUrl: form.imageUrl.trim() || '/images/hero.webp',
    price: Number(form.price),
    spicyLevel: Number(form.spicyLevel),
    servingSize: Number(form.servingSize),
  })
  await runAndMessage(res, {
    success: editing.value ? 'Đã cập nhật món ăn!' : 'Đã thêm món ăn!',
    fallback: 'Lưu thất bại',
    onSuccess: () => {
      modal.value = false
      void refresh()
    },
  })
}

const remove = async (id: number) => {
  mark(id, true)
  const res = await deleteFood(id)
  mark(id, false)
  await runAndMessage(res, {
    success: 'Đã xóa món ăn',
    fallback: 'Xóa thất bại',
    onSuccess: () => void refresh(),
  })
}

const categoryOptions = computed(() => (cats.value ?? []).map((c) => ({ label: c.name, value: c.id })))
const SPICY_OPTIONS = SPICY_LEVELS.map((s, i) => ({ label: s, value: i }))
const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang bán', value: 'available' },
  { label: 'Đã ẩn', value: 'hidden' },
]

const columns: DataTableColumns<Food> = [
  {
    title: 'Món', key: 'name', fixed: 'left', width: 240,
    render: (row) => h('div', { class: 'flex items-center gap-2.5' }, [
      h('img', { src: row.imageUrl ?? '', alt: row.name, loading: 'lazy', class: 'h-12 w-12 rounded-md object-cover' }),
      h('span', { class: 'text-sm font-medium text-stone-800' }, row.name),
    ]),
  },
  {
    title: 'Danh mục', key: 'category', width: 140,
    render: (row) => h(NTag, { size: 'small', round: false, bordered: false }, () => row.category?.name ?? 'Không có'),
  },
  { title: 'Giá', key: 'price', width: 130, render: (row) => h('span', { class: 'text-sm tabular-nums text-stone-600' }, formatVND(row.price)) },
  {
    title: 'Trạng thái', key: 'status', width: 110,
    render: (row) => h(StatusDot, { tone: row.available ? 'success' : 'danger', label: row.available ? 'Bán' : 'Ẩn' }),
  },
  {
    title: 'Thao tác', key: 'actions', width: 130,
    render: (row) => h('div', { class: 'flex items-center gap-1.5' }, [
      h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => 'Sửa'),
      h(NButton, {
        size: 'small', type: 'error', ghost: true,
        loading: busyIds.value.has(row.id),
        'aria-label': 'Xóa món',
        title: 'Xóa món',
        onClick: () => confirmRemove({ title: 'Xóa món này?', onOk: () => remove(row.id) }),
      }, () => h(NIcon, { size: 15 }, () => h(TrashOutline))),
    ]),
  },
]
</script>

<template>
  <div>
    <PageHeader title="Món ăn"><template #extra>
      <NButton type="primary" size="small" @click="openCreate">Thêm món</NButton>
    </template></PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <NInput v-model:value="search" placeholder="Tìm theo tên hoặc danh mục..." clearable size="small" class="w-full sm:w-64">
        <template #prefix><NIcon :size="14" class="text-stone-400"><SearchOutline /></NIcon></template>
      </NInput>
      <NSelect v-model:value="catFilter" clearable placeholder="Tất cả danh mục" size="small" class="min-w-0 flex-1 sm:flex-none sm:w-48" :options="categoryOptions" />
      <NSelect v-model:value="statusFilter" size="small" class="min-w-0 flex-1 sm:flex-none sm:w-40" :options="STATUS_OPTIONS" />
      <span v-if="search.trim() || catFilter !== undefined || statusFilter !== 'all'" class="text-xs text-stone-400">
        Hiển thị {{ rows.length }} / {{ data?.length ?? 0 }} món
      </span>
    </div>

    <PageCard>
      <TableSkeleton v-if="loading && !data" />
      <NEmpty v-else-if="rows.length === 0" class="py-10" description="Không có món ăn nào." />
      <NDataTable v-else :columns="columns" :data="rows" :row-key="(row: Food) => row.id" :pagination="{ pageSize: 10 }" :scroll-x="800" size="small" />
    </PageCard>

    <FormModal
      :title="editing ? `Sửa món: ${editing.name}` : 'Thêm món mới'"
      :show="modal"
      :saving="saving"
      :on-close="() => { modal = false }"
      :on-submit="submit"
    >
      <NForm ref="formRef" :model="form" :show-require-mark="false" size="small" class="mt-3">
        <div class="grid gap-x-3 md:grid-cols-2">
          <NFormItem label="Tên món" path="name" :rule="[{ required: true, message: 'Nhập tên', trigger: ['blur', 'input'] }]" class="md:col-span-2">
            <NInput v-model:value="form.name" />
          </NFormItem>
          <NFormItem label="Danh mục" path="categoryId" :rule="[{ required: true, message: 'Chọn danh mục', trigger: 'change' }]">
            <NSelect v-model:value="form.categoryId" placeholder="Chọn danh mục" :options="categoryOptions" />
          </NFormItem>
          <NFormItem label="Giá" path="price" :rule="[{ required: true, message: 'Nhập giá', trigger: ['blur', 'input'] }]">
            <NInputNumber v-model:value="form.price" :min="0" :step="1000" class="w-full">
              <template #suffix>đ</template>
            </NInputNumber>
          </NFormItem>
          <NFormItem label="Khẩu phần (người)" path="servingSize">
            <NInputNumber v-model:value="form.servingSize" :min="1" class="w-full" />
          </NFormItem>
          <NFormItem label="Độ cay" path="spicyLevel">
            <NSelect v-model:value="form.spicyLevel" :options="SPICY_OPTIONS" />
          </NFormItem>
          <NFormItem label="Mô tả" path="description" class="md:col-span-2">
            <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 2 }" />
          </NFormItem>
          <NFormItem label="Nguyên liệu" path="ingredients" class="md:col-span-2">
            <NInput v-model:value="form.ingredients" type="textarea" :autosize="{ minRows: 2 }" placeholder="Thịt, rau, gia vị..." />
          </NFormItem>
          <NFormItem label="Chế độ ăn" path="dietaryTags">
            <NInput v-model:value="form.dietaryTags" placeholder="chay, ít dầu mỡ..." />
          </NFormItem>
          <NFormItem label="Dị ứng" path="allergens">
            <NInput v-model:value="form.allergens" placeholder="Gluten, Tôm..." />
          </NFormItem>
          <NFormItem label="Ảnh món ăn" path="imageUrl" class="md:col-span-2">
            <ImageField v-model:value="form.imageUrl" />
          </NFormItem>
          <NCheckbox v-model:checked="form.available" class="md:col-span-2 rounded-md border border-stone-200 px-2.5 py-1.5">
            <span class="text-sm font-medium text-emerald-700">Đang bán</span>
            <span class="text-xs text-stone-500"> — tắt để ẩn món khỏi thực đơn</span>
          </NCheckbox>
        </div>
      </NForm>
    </FormModal>
  </div>
</template>
