<script setup lang="ts">
import { computed, h, reactive, ref, watchEffect } from 'vue'
import {
  NButton,
  NDataTable,
  NInput,
  NSelect,
  NForm,
  NFormItem,
  NEmpty,
  NIcon,
  type DataTableColumns,
} from 'naive-ui'
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { adminDeleteUser, adminGetUsers, adminSaveUser, adminSetUserActive, type UserPayload } from '@/admin/customer/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import useBusySet from '@/composables/useBusySet'
import { dialog, message } from '@/shared/api/message'
import type { User } from '@/shared/types'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { confirmRemove, runAndMessage } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import StatusDot from '@/admin/components/StatusDot.vue'
import TableSkeleton from '@/admin/components/TableSkeleton.vue'
import FormModal from '@/components/FormModal.vue'

const initialOf = (u: User): string => (u.fullName?.trim() || u.email?.trim() || '?').charAt(0).toUpperCase()

const { data: users, loading, error, refresh } = useAsyncData(() => adminGetUsers(), () => [])
watchEffect(() => {
  if (error.value) message.error('Không tải được danh sách khách hàng')
})

const { run: toggleActive } = useAsyncAction(
  (payload: { id: number; active: boolean }) => adminSetUserActive(payload.id, payload.active),
)
const { run: saveUser, pending: saving } = useAsyncAction(
  (payload: { id: number | null; data: UserPayload }) => adminSaveUser(payload.id, payload.data),
)
const { run: deleteUser } = useAsyncAction((id: number) => adminDeleteUser(id))

const search = ref('')
const roleFilter = ref<'CUSTOMER' | 'ADMIN'>('CUSTOMER')
const statusFilter = ref<'all' | 'active' | 'locked'>('all')
const { busyIds, mark } = useBusySet()
const modal = ref(false)
const editing = ref<User | null>(null)
const form = reactive({
  fullName: '',
  email: '',
  phone: '',
  address: '',
  password: '',
})
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const rows = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return (users.value ?? []).filter((u) => {
    if (u.role !== roleFilter.value) return false
    if (
      kw &&
      !u.fullName?.toLowerCase().includes(kw) &&
      !u.email?.toLowerCase().includes(kw) &&
      !(u.phone ?? '').includes(kw)
    ) {
      return false
    }
    if (statusFilter.value === 'active' && !u.active) return false
    if (statusFilter.value === 'locked' && u.active) return false
    return true
  })
})

const toggle = async (u: User) => {
  mark(u.id, true)
  const res = await toggleActive({ id: u.id, active: !u.active })
  mark(u.id, false)
  await runAndMessage(res, {
    success: 'Đã thay đổi trạng thái',
    fallback: 'Cập nhật thất bại',
    onSuccess: () => void refresh(),
  })
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, { fullName: '', email: '', phone: '', address: '', password: '' })
  modal.value = true
}
const openEdit = (u: User) => {
  editing.value = u
  Object.assign(form, { fullName: u.fullName, email: u.email, phone: u.phone ?? '', address: u.address ?? '', password: '' })
  modal.value = true
}

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  const res = await saveUser({
    id: editing.value?.id ?? null,
    data: {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() ?? '',
      password: form.password?.trim() || undefined,
    },
  })
  await runAndMessage(res, {
    success: editing.value ? 'Đã cập nhật khách hàng' : 'Đã tạo khách hàng',
    fallback: 'Lưu thất bại',
    onSuccess: () => {
      modal.value = false
      editing.value = null
      void refresh()
    },
  })
}

const remove = async (u: User) => {
  mark(u.id, true)
  const res = await deleteUser(u.id)
  mark(u.id, false)
  await runAndMessage(res, {
    success: 'Đã xóa khách hàng',
    fallback: 'Xóa thất bại',
    onSuccess: () => void refresh(),
  })
}

import type { FormItemRule } from 'naive-ui'
const nameRules: FormItemRule[] = [{ required: true, message: 'Nhập họ tên', trigger: ['blur', 'input'] }]
const emailRules: FormItemRule[] = [
  { required: true, message: 'Nhập email', trigger: ['blur', 'input'] },
  { type: 'email', message: 'Email không hợp lệ', trigger: ['blur', 'input'] },
]
const phoneRules: FormItemRule[] = [
  { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] },
]
const passwordRules = computed<FormItemRule[]>(() =>
  editing.value
    ? [{ min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự', trigger: ['input'] }]
    : [
        { required: true, message: 'Nhập mật khẩu', trigger: ['blur', 'input'] },
        { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự', trigger: ['input'] },
      ],
)

const ROLE_OPTIONS = [
  { label: 'Khách hàng', value: 'CUSTOMER' },
  { label: 'Quản trị viên', value: 'ADMIN' },
]
const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Hoạt động', value: 'active' },
  { label: 'Bị khóa', value: 'locked' },
]

const columns: DataTableColumns<User> = [
  { title: 'ID', key: 'id', width: 70, fixed: 'left', render: (row) => h('span', { class: 'tabular-nums' }, `#${row.id}`) },
  {
    title: 'Họ tên', key: 'fullName', fixed: 'left',
    render: (row) => h('div', { class: 'flex items-center gap-3' }, [
      h('span', { class: 'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600' }, initialOf(row)),
      h('span', { class: 'font-medium text-stone-700' }, row.fullName || '—'),
    ]),
  },
  { title: 'Email', key: 'email', render: (row) => h('span', { class: 'text-stone-500' }, row.email) },
  { title: 'SĐT', key: 'phone', width: 140, render: (row) => h('span', { class: 'tabular-nums text-stone-600' }, row.phone || '—') },
  {
    title: 'Vai trò', key: 'role', width: 120,
    render: (row) => h('span', { class: 'rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500' }, row.role === 'ADMIN' ? 'Quản trị' : 'Khách hàng'),
  },
  {
    title: 'Trạng thái', key: 'active', width: 140,
    render: (row) => h(StatusDot, row.active ? { tone: 'success', label: 'Hoạt động' } : { tone: 'neutral', label: 'Đã khóa', muted: true }),
  },
  {
    title: 'Thao tác', key: 'actions', width: 250,
    render: (row) => {
      if (row.role === 'ADMIN') {
        return h('span', { class: 'text-xs text-stone-400' }, 'Tài khoản hệ thống')
      }
      return h('div', { class: 'flex items-center gap-2' }, [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => 'Sửa'),
        h(NButton, {
          size: 'small',
          loading: busyIds.value.has(row.id),
          ...(row.active ? { type: 'warning' as const, ghost: true } : {}),
          onClick: () => {
            dialog.warning({
              title: `${row.active ? 'Khóa' : 'Kích hoạt'} ${row.fullName}?`,
              positiveText: row.active ? 'Khóa' : 'Kích hoạt',
              negativeText: 'Hủy',
              onPositiveClick: () => toggle(row),
            })
          },
        }, () => (row.active ? 'Khóa' : 'Kích hoạt')),
        h(NButton, {
          size: 'small', type: 'error', ghost: true,
          loading: busyIds.value.has(row.id),
          onClick: () => confirmRemove({ title: 'Xóa khách hàng này?', content: 'Giỏ hàng bị xoá kèm. Đơn hàng đã đặt vẫn được giữ lại.', onOk: () => remove(row) }),
        }, () => h(NIcon, { size: 15 }, () => h(TrashOutline))),
      ])
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="Khách hàng"><template #extra>
      <NButton type="primary" size="small" @click="openCreate">Thêm khách hàng</NButton>
    </template></PageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <NInput v-model:value="search" placeholder="Tìm theo tên, email hoặc số điện thoại..." clearable class="w-full sm:w-80">
        <template #prefix><NIcon :size="16" class="text-stone-400"><SearchOutline /></NIcon></template>
      </NInput>
      <NSelect v-model:value="roleFilter" class="min-w-0 flex-1 sm:flex-none sm:w-44" :options="ROLE_OPTIONS" />
      <NSelect v-model:value="statusFilter" class="min-w-0 flex-1 sm:flex-none sm:w-48" :options="STATUS_OPTIONS" />
    </div>

    <PageCard>
      <TableSkeleton v-if="loading && !users" />
      <NEmpty v-else-if="rows.length === 0" class="py-10" description="Không tìm thấy tài khoản." />
      <NDataTable v-else :columns="columns" :data="rows" :row-key="(row: User) => row.id" :pagination="{ pageSize: 10 }" :scroll-x="900" size="small" />
    </PageCard>

    <FormModal :title="editing ? `Sửa: ${editing.fullName}` : 'Thêm khách hàng'" :show="modal" :saving="saving" :on-close="() => { modal = false }" :on-submit="submit">
      <NForm ref="formRef" :model="form" :show-require-mark="false" class="mt-4">
        <NFormItem label="Họ và tên" path="fullName" :rule="nameRules">
          <NInput v-model:value="form.fullName" placeholder="Nguyễn Văn A" size="medium" />
        </NFormItem>
        <NFormItem label="Email" path="email" :rule="emailRules">
          <NInput v-model:value="form.email" placeholder="ban@example.com" size="medium" />
        </NFormItem>
        <NFormItem label="Số điện thoại" path="phone" :rule="phoneRules">
          <NInput v-model:value="form.phone" placeholder="0900000000" size="medium" />
        </NFormItem>
        <NFormItem label="Địa chỉ" path="address">
          <NInput v-model:value="form.address" size="medium" />
        </NFormItem>
        <NFormItem :label="editing ? 'Mật khẩu mới' : 'Mật khẩu'" path="password" :rule="passwordRules">
          <NInput v-model:value="form.password" type="password" autocomplete="new-password" size="medium" />
          <template #feedback>
            <span v-if="editing" class="text-xs text-stone-400">Để trống nếu không muốn đổi mật khẩu.</span>
          </template>
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
