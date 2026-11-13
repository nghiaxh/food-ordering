<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { NButton, NInput, NForm, NFormItem, NIcon, NTooltip } from 'naive-ui'
import {
  SearchOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { adminDeleteCategory, adminSaveCategory } from '@/admin/menu/api'
import { getCategories, getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import type { Category } from '@/shared/types'
import { slugify } from '@/shared/utils/slug'
import { confirmRemove, runAndMessage } from '@/admin/components/shared'
import PageHeader from '@/admin/components/PageHeader.vue'
import PageCard from '@/admin/components/PageCard.vue'
import EmptyState from '@/admin/components/EmptyState.vue'
import ImageField from '@/admin/components/ImageField.vue'
import FormModal from '@/components/FormModal.vue'
import { message } from '@/shared/api/message'

const modal = ref(false)
const editing = ref<Category | null>(null)
const busyId = ref<number | null>(null)
const search = ref('')

const form = reactive({ name: '', description: '', imageUrl: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const { data, loading, refresh } = useAsyncData((signal) => getCategories(signal), () => [])
const { data: foods } = useAsyncData((signal) => getFoods(undefined, signal), () => [])
const { run: saveCategory, pending: saving } = useAsyncAction(
  (payload: { id: number | null; name: string; slug: string; imageUrl: string; description: string }) =>
    adminSaveCategory(payload.id, payload),
)
const { run: deleteCategory } = useAsyncAction((id: number) => adminDeleteCategory(id))

const counts = computed(() => {
  const map = new Map<number, number>()
  for (const f of foods.value ?? []) {
    if (f.category) map.set(f.category.id, (map.get(f.category.id) ?? 0) + 1)
  }
  return map
})
const rows = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return data.value ?? []
  return (data.value ?? []).filter((c) => c.name.toLowerCase().includes(kw) || (c.slug ?? '').toLowerCase().includes(kw))
})
const slugPreview = computed(() => editing.value?.slug ?? slugify(form.name.trim()))

const openCreate = () => {
  editing.value = null
  Object.assign(form, { name: '', description: '', imageUrl: '' })
  modal.value = true
}
const openEdit = (c: Category) => {
  editing.value = c
  Object.assign(form, { name: c.name, description: c.description ?? '', imageUrl: c.imageUrl ?? '' })
  modal.value = true
}

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const trimmed = form.name.trim()
  if (!trimmed) {
    message.warning('Nhập tên danh mục')
    return
  }
  const res = await saveCategory({
    id: editing.value?.id ?? null,
    name: trimmed,
    slug: editing.value?.slug?.trim() ? editing.value.slug : slugify(trimmed),
    imageUrl: form.imageUrl.trim() || editing.value?.imageUrl || '',
    description: form.description.trim() ?? '',
  })
  await runAndMessage(res, {
    success: 'Đã lưu danh mục',
    fallback: 'Lưu thất bại',
    onSuccess: () => {
      modal.value = false
      editing.value = null
      void refresh()
    },
  })
}

const remove = async (id: number) => {
  busyId.value = id
  const res = await deleteCategory(id)
  busyId.value = null
  await runAndMessage(res, {
    success: 'Đã xóa',
    fallback: 'Xóa thất bại',
    onSuccess: () => void refresh(),
  })
}
</script>

<template>
  <div>
    <PageHeader title="Danh mục"><template #extra>
      <NButton type="primary" size="small" @click="openCreate">Tạo danh mục</NButton>
    </template></PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <NInput v-model:value="search" placeholder="Tìm theo tên hoặc slug..." clearable size="small" class="w-full sm:w-64">
        <template #prefix><NIcon :size="14" class="text-stone-400"><SearchOutline /></NIcon></template>
      </NInput>
      <span v-if="search.trim()" class="text-xs text-stone-400">Hiển thị {{ rows.length }} / {{ data?.length ?? 0 }} danh mục</span>
    </div>

    <div v-if="loading && !data" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="overflow-hidden rounded-md border border-stone-200 bg-white">
        <div class="aspect-[4/3] bg-stone-100" />
        <div class="space-y-2 p-2.5">
          <div class="h-3 w-1/2 rounded-full bg-stone-100" />
          <div class="h-2.5 w-1/3 rounded-full bg-stone-100" />
        </div>
      </div>
    </div>

    <div v-else-if="rows.length > 0" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="c in rows" :key="c.id" class="group overflow-hidden rounded-md border border-stone-200 bg-white transition hover:border-orange-300">
        <div class="relative aspect-[4/3] overflow-hidden">
          <img :src="c.imageUrl ?? ''" :alt="c.name" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          <span class="absolute left-2 top-2 rounded-md bg-stone-900/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {{ counts.get(c.id) ?? 0 }} món
          </span>
        </div>
        <div class="p-2.5">
          <p class="truncate text-sm font-semibold text-stone-800" :title="c.name">{{ c.name }}</p>
          <p class="mt-0.5 truncate text-[11px] text-stone-400">/{{ c.slug }}</p>
          <div class="mt-2 flex items-center gap-1.5">
            <NButton size="small" class="flex-1" @click="openEdit(c)">Sửa</NButton>
            <NTooltip :disabled="(counts.get(c.id) ?? 0) === 0">
              <template #trigger>
                <span>
                  <NButton
                    size="small" type="error" ghost
                    :loading="busyId === c.id"
                    :disabled="(counts.get(c.id) ?? 0) > 0"
                    aria-label="Xóa danh mục"
                    title="Xóa danh mục"
                    @click="confirmRemove({ title: 'Xóa danh mục này?', onOk: () => remove(c.id) })"
                  >
                    <template #icon><NIcon :size="15"><TrashOutline /></NIcon></template>
                  </NButton>
                </span>
              </template>
              {{ `Còn ${counts.get(c.id)} món, không thể xóa` }}
            </NTooltip>
          </div>
        </div>
      </div>
    </div>

    <PageCard v-else>
      <EmptyState :title="data?.length ? 'Không tìm thấy danh mục nào.' : 'Chưa có danh mục nào.'" :hint="data?.length ? 'Điều chỉnh từ khóa tìm kiếm.' : 'Tạo danh mục đầu tiên để tổ chức thực đơn.'" />
    </PageCard>

    <FormModal
      :title="editing ? `Sửa: ${editing.name}` : 'Tạo danh mục'"
      :show="modal"
      :saving="saving"
      :on-close="() => { modal = false }"
      :on-submit="submit"
    >
      <NForm ref="formRef" :model="form" :show-require-mark="false" size="small" class="mt-3">
        <NFormItem label="Tên danh mục" path="name" :rule="[{ required: true, message: 'Nhập tên danh mục', trigger: ['blur', 'input'] }]">
          <NInput v-model:value="form.name" placeholder="Món Việt" @keyup.enter="submit" />
        </NFormItem>
        <p class="-mt-2 mb-4 text-xs text-stone-400">Slug tự động: <span class="font-medium text-stone-500">/{{ slugPreview }}</span></p>
        <NFormItem label="Mô tả" path="description">
          <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 2 }" placeholder="Mô tả ngắn danh mục, tuỳ chọn" />
        </NFormItem>
        <NFormItem label="Ảnh danh mục" path="imageUrl">
          <ImageField v-model:value="form.imageUrl" />
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
