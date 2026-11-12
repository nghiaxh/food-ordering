<script setup lang="ts">
import { computed, h, reactive, ref, watchEffect } from 'vue'
import {
  NButton,
  NCheckbox,
  NDataTable,
  NDrawer,
  NInput,
  NInputNumber,
  NSelect,
  NForm,
  NFormItem,
  NIcon,
  NEmpty,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'
import {
  adminDeleteOrder,
  adminGetOrders,
  adminSaveOrder,
  adminUpdateOrderStatus,
  type AdminOrderPayload,
} from '@/admin/order/api'
import { adminGetUsers } from '@/admin/customer/api'
import { adminUpdateOrderPayment } from '@/admin/payment/api'
import { getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import useBusySet from '@/composables/useBusySet'
import type { Order, OrderStatus } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, allowedNextStatuses, orderCode } from '@/shared/utils/orders'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { confirmRemove, runAndMessage } from '@/admin/components/shared'
import PageCard from '@/admin/components/PageCard.vue'
import PageHeader from '@/admin/components/PageHeader.vue'
import StatusDot from '@/admin/components/StatusDot.vue'
import TableSkeleton from '@/admin/components/TableSkeleton.vue'
import FormModal from '@/components/FormModal.vue'
import { message } from '@/shared/api/message'

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED']
const STATUS_HEX: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PREPARING: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
}

const { data: orders, loading, error, refresh } = useAsyncData(() => adminGetOrders(), () => [])
const { data: users } = useAsyncData(() => adminGetUsers(), () => [])
const { data: foods } = useAsyncData(() => getFoods(undefined, undefined), () => [])
watchEffect(() => {
  if (error.value) message.error('Không tải được đơn hàng')
})

const { run: updateStatus } = useAsyncAction(
  (payload: { id: number; status: OrderStatus }) => adminUpdateOrderStatus(payload.id, payload.status),
)
const { run: updatePayment } = useAsyncAction(
  (payload: { id: number; paid: boolean }) => adminUpdateOrderPayment(payload.id, payload.paid),
)
const { run: saveOrder, pending: saving } = useAsyncAction(
  (payload: { id: number | null; data: AdminOrderPayload }) => adminSaveOrder(payload.id, payload.data),
)
const { run: deleteOrder } = useAsyncAction((id: number) => adminDeleteOrder(id))
const { busyIds, mark } = useBusySet()

const statusFilter = ref<OrderStatus | 'ALL'>('ALL')
const detailId = ref<number | null>(null)
const modal = ref(false)
const editing = ref<Order | null>(null)

const detail = computed(() => orders.value?.find((o) => o.id === detailId.value) ?? null)
const rows = computed(() => {
  const list = orders.value ?? []
  if (statusFilter.value === 'ALL') return list
  return list.filter((o) => o.status === statusFilter.value)
})
const finalState = (o: Order) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
// Don da giao hoac da huy thi khoa hoan toan; don da thu tien hoac da xac nhan chi sua
// duoc thong tin giao hang, khong doi mon. Server kiem lai dung luat nay.
const itemsLocked = computed(() =>
  !!editing.value && !(editing.value.status === 'PENDING' && editing.value.paymentStatus === 'UNPAID'),
)

const changeStatus = async (id: number, status: OrderStatus) => {
  mark(id, true)
  const res = await updateStatus({ id, status })
  mark(id, false)
  await runAndMessage(res, {
    success: 'Đã cập nhật trạng thái',
    fallback: 'Cập nhật thất bại',
    onSuccess: () => void refresh(),
  })
}
const changePayment = async (id: number, paid: boolean) => {
  mark(id, true)
  const res = await updatePayment({ id, paid })
  mark(id, false)
  await runAndMessage(res, {
    success: 'Đã cập nhật trạng thái thanh toán',
    fallback: 'Cập nhật thanh toán thất bại',
    onSuccess: () => void refresh(),
  })
}

// Form tao/sua don
const form = reactive({
  customerEmail: '',
  receiverName: '',
  phone: '',
  address: '',
  paymentMethod: 'COD',
  status: 'PENDING' as OrderStatus,
  paid: false,
  note: '',
  items: [] as Array<{ foodId: number | null; quantity: number }>,
})
const formRef = ref<InstanceType<typeof NForm> | null>(null)
const userOptions = computed(() => (users.value ?? []).filter((u) => u.email).map((u) => ({ label: `${u.fullName} (${u.email})`, value: u.email })))
const foodOptions = computed(() =>
  (foods.value ?? []).map((f) => ({
    label: `${f.name} · ${formatVND(f.price)}${f.available ? '' : ' (tạm hết)'}`,
    value: f.id,
    disabled: !f.available,
  })),
)
const statusOptions = ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s }))

const openCreate = () => {
  editing.value = null
  Object.assign(form, { customerEmail: '', receiverName: '', phone: '', address: '', paymentMethod: 'COD', status: 'PENDING', paid: false, note: '', items: [{ foodId: null, quantity: 1 }] })
  modal.value = true
}
const openEdit = (o: Order) => {
  editing.value = o
  Object.assign(form, {
    customerEmail: o.user?.email ?? '',
    receiverName: o.receiverName,
    phone: o.phone,
    address: o.address,
    paymentMethod: o.paymentMethod,
    status: o.status,
    paid: o.paymentStatus === 'PAID',
    note: o.note ?? '',
    items: o.items.map((i) => ({ foodId: i.food?.id ?? null, quantity: i.quantity })),
  })
  modal.value = true
}
const addItem = () => form.items.push({ foodId: null, quantity: 1 })
const removeItem = (index: number) => form.items.splice(index, 1)

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  // Khi don da qua buoc dat mon, khong gui danh sach mon len de server khong hieu la
  // dang thay mon (server chan thao tac do sau khi don da xac nhan hoac da thu tien).
  const { items, ...rest } = form
  const data: AdminOrderPayload = {
    ...rest,
    note: form.note.trim() || undefined,
    ...(itemsLocked.value ? {} : { items: items.map((i) => ({ foodId: i.foodId ?? undefined, quantity: i.quantity })) }),
  }
  const res = await saveOrder({ id: editing.value?.id ?? null, data })
  await runAndMessage(res, {
    success: editing.value ? 'Đã cập nhật đơn hàng' : 'Đã tạo đơn hàng',
    fallback: 'Lưu thất bại',
    onSuccess: () => {
      modal.value = false
      editing.value = null
      void refresh()
    },
  })
}

const remove = async (id: number) => {
  mark(id, true)
  const res = await deleteOrder(id)
  mark(id, false)
  await runAndMessage(res, {
    success: 'Đã xóa đơn hàng',
    fallback: 'Xóa thất bại',
    onSuccess: () => {
      if (detailId.value === id) detailId.value = null
      void refresh()
    },
  })
}

const counts = computed(() => {
  const acc = new Map<OrderStatus, number>()
  for (const status of ORDER_STATUSES) {
    acc.set(status, (orders.value ?? []).filter((o) => o.status === status).length)
  }
  return acc
})

const columns: DataTableColumns<Order> = [
  { title: 'Mã đơn', key: 'id', width: 90, fixed: 'left', render: (row) => h('span', { class: 'tabular-nums' }, `#${orderCode(row.id)}`) },
  {
    title: 'Khách', key: 'receiver', width: 160, fixed: 'left',
    render: (row) => h('div', { class: 'flex flex-col text-stone-700' }, [
      h('span', { class: 'block truncate font-medium', title: row.receiverName }, row.receiverName),
      h('span', { class: 'text-xs tabular-nums text-stone-400' }, row.phone),
    ]),
  },
  { title: 'Địa chỉ', key: 'address', width: 200, render: (row) => h('span', { class: 'text-stone-500' }, row.address) },
  {
    title: 'Món đặt', key: 'items', width: 110,
    render: (row) => h('span', { class: 'whitespace-nowrap rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500' },
      `${row.items.reduce((sum, i) => sum + i.quantity, 0)} món`),
  },
  { title: 'Tổng tiền', key: 'total', width: 140, render: (row) => h('b', { class: 'tabular-nums' }, formatVND(row.total)) },
  {
    title: 'Trạng thái', key: 'status', width: 180,
    render: (row) => h(StatusDot, { color: STATUS_HEX[row.status], label: ORDER_STATUS_LABEL[row.status] ?? row.status }),
  },
  {
    title: 'Thao tác nhanh', key: 'actions', width: 320,
    render: (row) => {
      const nexts = allowedNextStatuses(row.status)
      const primaryNext = nexts.find((s) => s !== 'CANCELLED')
      const blockedByQr = primaryNext === 'CONFIRMED' && row.paymentMethod === 'QR' && row.paymentStatus === 'UNPAID'
      return h('div', { class: 'flex items-center gap-1.5' }, [
        primaryNext
          ? h(NTooltip, { ...(blockedByQr ? { title: 'Khách chưa thanh toán' } : {}) }, {
              trigger: () => h('span', {}, [
                h(NButton, {
                  type: 'primary',
                  size: 'small',
                  loading: busyIds.value.has(row.id),
                  disabled: blockedByQr,
                  onClick: () => void changeStatus(row.id, primaryNext),
                }, () => (primaryNext === 'CONFIRMED' ? 'Duyệt đơn' : primaryNext === 'PREPARING' ? 'Giao hàng' : 'Hoàn thành')),
              ]),
            })
          : null,
        h(NButton, { size: 'small', onClick: () => { detailId.value = row.id } }, () => 'Chi tiết'),
        h(NButton, {
          size: 'small',
          disabled: finalState(row),
          title: finalState(row) ? 'Đơn đã chốt nên không sửa được' : undefined,
          onClick: () => openEdit(row),
        }, () => 'Sửa'),
        h(NButton, {
          size: 'small', type: 'error', ghost: true,
          loading: busyIds.value.has(row.id),
          onClick: () => confirmRemove({ title: 'Xóa đơn này?', onOk: () => remove(row.id) }),
        }, () => h(NIcon, { size: 15 }, () => h(TrashOutline))),
      ])
    },
  },
]

const STATUS_TABS = computed<Array<{ key: OrderStatus | 'ALL'; label: string; dot?: string }>>(() => [
  { key: 'ALL' as const, label: `Tất cả (${orders.value?.length ?? 0})` },
  ...ORDER_STATUSES.map((s) => ({ key: s as OrderStatus | 'ALL', label: `${ORDER_STATUS_LABEL[s]}${counts.value.get(s) ? ` (${counts.value.get(s)})` : ''}`, dot: STATUS_HEX[s] })),
])

// Options cho NSelect doi trang thai trong drawer; tinh o script de template khong phai narrow trong callback.
const onDetailStatusChange = (s: string) => {
  if (detail.value) changeStatus(detail.value.id, s as OrderStatus)
}
const statusSelectOptions = computed(() => {  const d = detail.value
  if (!d) return []
  return [
    { label: ORDER_STATUS_LABEL[d.status], value: d.status as string, disabled: true },
    ...allowedNextStatuses(d.status).map((s) => ({
      label: ORDER_STATUS_LABEL[s],
      value: s as string,
      disabled: s === 'CONFIRMED' && d.paymentMethod === 'QR' && d.paymentStatus === 'UNPAID',
    })),
  ]
})
</script>

<template>
  <div>
    <PageHeader title="Đơn hàng"><template #extra>
      <NButton type="primary" @click="openCreate">Thêm đơn</NButton>
    </template></PageHeader>

    <div class="mb-5 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Lọc theo trạng thái đơn">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="statusFilter === tab.key"
        class="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
        :class="statusFilter === tab.key ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'"
        @click="statusFilter = tab.key"
      >
        <span v-if="tab.dot" class="inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: tab.dot }" />
        {{ tab.label }}
      </button>
    </div>

    <PageCard>
      <TableSkeleton v-if="loading && !orders" />
      <NEmpty v-else-if="rows.length === 0" class="py-16" description="Không có đơn hàng nào." />
      <NDataTable v-else :columns="columns" :data="rows" :row-key="(row: Order) => row.id" :pagination="{ pageSize: 10 }" :scroll-x="1200" size="small" />
    </PageCard>

    <!-- Chi tiet don -->
    <NDrawer :show="detailId !== null" placement="right" :width="480" :auto-focus="false" @update:show="(v: boolean) => !v && (detailId = null)">
      <template #header>
        <span class="text-base font-semibold text-stone-900">{{ detail ? `Đơn #${orderCode(detail.id)}` : 'Chi tiết đơn' }}</span>
      </template>
      <div v-if="detail" class="space-y-6 p-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <StatusDot :color="STATUS_HEX[detail.status]" :label="ORDER_STATUS_LABEL[detail.status] ?? detail.status" />
          <div class="flex items-center gap-2">
            <NSelect
              size="small"
              :value="detail.status"
              :loading="busyIds.has(detail.id)"
              :disabled="busyIds.has(detail.id) || allowedNextStatuses(detail.status).length === 0"
              style="width: 160px"
              :options="statusSelectOptions"
              @update:value="onDetailStatusChange"
            />
            <NButton size="small" :disabled="finalState(detail)" :title="finalState(detail) ? 'Đơn đã chốt nên không sửa được' : undefined" @click="openEdit(detail)">Sửa</NButton>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Thông tin đơn</p>
          <div class="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
            <p>Đặt lúc: <b class="font-medium text-stone-800">{{ new Date(detail.createdAt).toLocaleString('vi-VN') }}</b></p>
            <p>Thanh toán: <b class="font-medium text-stone-800">{{ PAYMENT_METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod }}</b></p>
            <div class="flex items-center justify-between gap-3 pt-2">
              <span class="text-sm text-stone-600">Trạng thái: <b class="font-medium text-stone-800">{{ detail.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán' }}</b></span>
              <NButton v-if="detail.paymentStatus === 'PAID'" size="small" :loading="busyIds.has(detail.id)" :disabled="busyIds.has(detail.id)" @click="changePayment(detail.id, false)">Hoàn tác</NButton>
              <NButton v-else type="primary" size="small" :loading="busyIds.has(detail.id)" :disabled="busyIds.has(detail.id)" @click="changePayment(detail.id, true)">Đã thanh toán</NButton>
            </div>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Người nhận</p>
          <div class="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
            <p><b class="font-medium text-stone-800">{{ detail.receiverName }}</b></p>
            <p class="tabular-nums">{{ detail.phone }}</p>
            <p>{{ detail.address }}</p>
            <p v-if="detail.user?.email" class="text-stone-400">{{ detail.user.email }}</p>
          </div>
        </div>

        <div v-if="detail.note">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Lưu ý cho quán</p>
          <p class="rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">{{ detail.note }}</p>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Món đặt ({{ detail.items.length }})</p>
          <div class="space-y-2.5">
            <div v-for="item in detail.items" :key="item.id" class="flex items-center gap-3 rounded-xl border border-stone-100 p-2.5">
              <img v-if="item.food?.imageUrl" :src="item.food.imageUrl" :alt="item.food?.name ?? ''" loading="lazy" class="h-12 w-12 rounded-lg object-cover" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-stone-800">{{ item.food?.name }}</p>
                <p class="text-xs text-stone-400">
                  {{ formatVND(item.price) }} × {{ item.quantity }}
                  <span v-if="item.discountAmount" class="ml-1 text-emerald-600">· giảm {{ formatVND(item.discountAmount) }}</span>
                </p>
              </div>
              <b class="text-sm tabular-nums text-stone-800">{{ formatVND(item.price * item.quantity - (item.discountAmount ?? 0)) }}</b>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-stone-100 pt-4">
          <span class="text-sm text-stone-500">Tổng cộng</span>
          <b class="text-lg tabular-nums text-stone-900">{{ formatVND(detail.total) }}</b>
        </div>
      </div>
    </NDrawer>

    <!-- Form tao/sua don -->
    <FormModal :title="editing ? `Sửa đơn #${editing.id}` : 'Thêm đơn hàng'" :show="modal" :saving="saving" :on-close="() => { modal = false }" :on-submit="submit">
      <NForm ref="formRef" :model="form" :show-require-mark="false" class="mt-4">
        <NFormItem label="Khách hàng" path="customerEmail" :rule="[{ required: true, message: 'Chọn khách hàng', trigger: 'change' }]">
          <NSelect v-model:value="form.customerEmail" filterable placeholder="Chọn khách để gắn đơn" :options="userOptions" size="medium" />
        </NFormItem>

        <div class="grid gap-x-3 sm:grid-cols-2">
          <NFormItem label="Người nhận" path="receiverName" :rule="[{ required: true, message: 'Nhập tên người nhận', trigger: ['blur', 'input'] }]">
            <NInput v-model:value="form.receiverName" size="medium" />
          </NFormItem>
          <NFormItem label="Số điện thoại" path="phone" :rule="[{ required: true, message: 'Nhập số điện thoại', trigger: ['blur', 'input'] }, { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] }]">
            <NInput v-model:value="form.phone" placeholder="0900000000" size="medium" />
          </NFormItem>
        </div>

        <NFormItem label="Địa chỉ giao hàng" path="address" :rule="[{ required: true, message: 'Nhập địa chỉ', trigger: ['blur', 'input'] }]">
          <NInput v-model:value="form.address" size="medium" />
        </NFormItem>

        <div class="grid gap-x-3 sm:grid-cols-3">
          <NFormItem label="Thanh toán" path="paymentMethod" :rule="[{ required: true }]">
            <NSelect v-model:value="form.paymentMethod" :options="PAYMENT_METHODS" size="medium" />
          </NFormItem>
          <NFormItem label="Trạng thái" path="status">
            <NSelect v-model:value="form.status" :options="statusOptions" size="medium" />
          </NFormItem>
          <NFormItem label="Thanh toán" path="paid">
            <NCheckbox v-model:checked="form.paid">Đã thanh toán</NCheckbox>
          </NFormItem>
        </div>

        <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Món đặt</p>
        <p v-if="itemsLocked" class="mb-2 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
          Đơn đã xác nhận hoặc đã thu tiền nên chỉ sửa được người nhận, số điện thoại, địa chỉ và ghi chú. Muốn đổi món, hãy hủy đơn và tạo đơn mới.
        </p>
        <div v-for="(item, index) in form.items" :key="index" class="mb-2 flex items-start gap-2">
          <NSelect v-model:value="item.foodId" filterable placeholder="Chọn món" :options="foodOptions" :disabled="itemsLocked" size="medium" class="min-w-0 flex-1" />
          <NInputNumber v-model:value="item.quantity" :min="1" :max="99" :disabled="itemsLocked" size="medium" style="width: 80px" />
          <NButton type="error" ghost size="medium" :disabled="itemsLocked" :aria-label="'Bỏ món khỏi đơn'" @click="removeItem(index)">
            <template #icon><NIcon :size="15"><TrashOutline /></NIcon></template>
          </NButton>
        </div>
        <NButton block dashed :disabled="itemsLocked" @click="addItem">Thêm món</NButton>

        <NFormItem label="Lưu ý cho quán" path="note" class="mt-4" :show-feedback="false">
          <NInput v-model:value="form.note" type="textarea" :autosize="{ minRows: 2 }" :maxlength="255" show-count size="medium" />
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
