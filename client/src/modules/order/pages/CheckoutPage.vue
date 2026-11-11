<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  NEmpty,
  NIcon,
  NSkeleton,
} from 'naive-ui'
import {
  CashOutline,
  QrCodeOutline,
  PencilOutline,
} from '@vicons/ionicons5'
import { createOrder, getAddresses, saveAddress } from '@/modules/order/api'
import useAsyncAction from '@/composables/useAsyncAction'
import useCartQuote from '@/composables/useCartQuote'
import { useAuthStore } from '@/modules/auth/store'
import { useCartStore } from '@/modules/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import type { SavedAddress } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import FormModal from '@/components/FormModal.vue'
import type { FormItemRule } from 'naive-ui'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255
const NOTE_SUGGESTIONS = ['Ít cay', 'Không hành', 'Gọi trước 10 phút']

/**
 * Trang dat mon duy nhat. Danh sach mon sua duoc da chuyen sang drawer gio; o day chi con
 * thong tin giao hang, thanh toan va tom tat tien. Server van la noi tinh tien duy nhat
 * qua useCartQuote; client khong tu nhan phan tram hay tru khuyen mai.
 */
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const ui = useUiStore()
const NOTE_CHIPS = NOTE_SUGGESTIONS

const ordering = ref(false)
const addresses = ref<SavedAddress[]>([])
const addressesLoaded = ref(false)
const selectedId = ref<number | null>(null)
const addressModal = ref(false)
const editingAddress = ref<SavedAddress | null>(null)
const savingAddress = ref(false)

const form = reactive({ receiverName: auth.user?.fullName ?? '', phone: '', address: '', note: '', paymentMethod: 'COD' })
const addrForm = reactive({ label: '', receiverName: '', phone: '', address: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)
const addrFormRef = ref<InstanceType<typeof NForm> | null>(null)

const { quote, quoteLoading, quoteError, quoteStale } = useCartQuote(() => cart.items)

const { run: submitOrder, pending: submitting } = useAsyncAction(
  (payload: {
    items: { foodId?: number; quantity: number }[]
    receiverName: string
    phone: string
    address: string
    paymentMethod: string
    note?: string
  }) => createOrder(payload),
)

onMounted(() => {
  if (!auth.user) return
  getAddresses()
    .then((list) => { addresses.value = list })
    .catch(() => { addresses.value = [] })
})

const applyAddress = (address: SavedAddress) => {
  selectedId.value = address.id
  form.receiverName = address.receiverName
  form.phone = address.phone
  form.address = address.address
}

// Khi danh sach dia chi tra ve, chon dia chi mac dinh (hoac dau tien) cho form.
watch(
  addresses,
  (list) => {
    if (addressesLoaded.value) return
    addressesLoaded.value = true
    const def = list.find((a) => a.isDefault) ?? list[0]
    if (def) applyAddress(def)
  },
  { once: true },
)

const openAddressModal = (address?: SavedAddress) => {
  editingAddress.value = address ?? null
  addrForm.label = address?.label ?? ''
  addrForm.receiverName = address?.receiverName ?? ''
  addrForm.phone = address?.phone ?? ''
  addrForm.address = address?.address ?? ''
  addressModal.value = true
}

const submitAddress = async () => {
  try {
    await addrFormRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  try {
    savingAddress.value = true
    const saved = await saveAddress(editingAddress.value?.id ?? null, {
      label: addrForm.label.trim() || undefined,
      receiverName: addrForm.receiverName.trim(),
      phone: addrForm.phone,
      address: addrForm.address.trim(),
    })
    addresses.value = [saved, ...addresses.value.filter((a) => a.id !== saved.id)]
    applyAddress(saved)
    addressModal.value = false
    message.success('Đã lưu địa chỉ giao hàng')
  } catch {
    message.error('Không lưu được địa chỉ. Kiểm tra lại thông tin.')
  } finally {
    savingAddress.value = false
  }
}

const addNote = (text: string) => {
  const current = form.note.trim()
  if (current.toLowerCase().includes(text.toLowerCase())) return
  form.note = current ? `${current}. ${text}` : text
}

const checkout = async () => {
  if (!auth.user) {
    message.warning('Vui lòng đăng nhập để đặt món')
    router.push('/login')
    return
  }
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  if (submitting.value || ordering.value) return
  if (!quote.value || quoteLoading.value || quoteError.value) return
  ordering.value = true
  const res = await submitOrder({
    items: cart.items.map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
    receiverName: form.receiverName,
    phone: form.phone,
    address: form.address,
    paymentMethod: form.paymentMethod,
    note: form.note.trim() || undefined,
  })
  ordering.value = false
  if (res.ok) {
    await cart.clear()
    message.success('Đặt món thành công')
    router.push('/orders')
  } else {
    message.error(apiErrorMessage(res.error) ?? 'Đặt món thất bại')
  }
}

const canSubmit = computed(() => Boolean(quote.value) && !quoteLoading.value && !quoteError.value && !submitting.value && !ordering.value)
const totalQuantity = computed(() => cart.items.reduce((n, i) => n + i.quantity, 0))

const nameRules: FormItemRule[] = [{ required: true, message: 'Nhập tên người nhận', trigger: ['blur', 'input'] }]
const phoneRules: FormItemRule[] = [
  { required: true, message: 'Nhập số điện thoại', trigger: ['blur', 'input'] },
  { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] },
]
const addressRules: FormItemRule[] = [{ required: true, message: 'Nhập địa chỉ giao hàng', trigger: ['blur', 'input'] }]
const addrPhoneRules: FormItemRule[] = [
  { required: true, message: 'Nhập số điện thoại', trigger: ['blur', 'input'] },
  { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] },
]
const addrNameRules: FormItemRule[] = [{ required: true, message: 'Nhập tên người nhận', trigger: ['blur', 'input'] }]
const addrAddressRules: FormItemRule[] = [{ required: true, message: 'Nhập địa chỉ giao hàng', trigger: ['blur', 'input'] }]
</script>

<template>
  <div v-if="!cart.loaded" class="mx-auto max-w-5xl px-4 py-10"><NSkeleton :repeat="6" height="40px" /></div>

  <div v-else-if="auth.user?.role === 'ADMIN'" class="mx-auto max-w-3xl px-4 py-20 text-center">
    <NEmpty description="Tài khoản quản trị không thể đặt món">
      <NButton type="primary" class="mt-4" @click="router.push('/admin')">Về trang quản trị</NButton>
    </NEmpty>
  </div>

  <div v-else-if="cart.items.length === 0" class="mx-auto max-w-3xl px-4 py-20 text-center">
    <NEmpty description="Giỏ hàng của bạn đang trống">
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <NButton @click="ui.openDrawer('cart')">Xem giỏ hàng</NButton>
        <NButton type="primary" @click="router.push('/')">Khám phá thực đơn</NButton>
      </div>
    </NEmpty>
  </div>

  <div v-else class="mx-auto max-w-5xl px-3 py-6 pb-32 sm:px-6 lg:pb-10">
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
      <!-- Form thong tin giao hang + thanh toan + ghi chu -->
      <NForm :id="CHECKOUT_FORM_ID" ref="formRef" :model="form" layout="vertical" :show-require-mark="false" @submit.prevent="checkout">
        <section class="rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-bold text-stone-900">Thông tin giao hàng</h2>
            <NButton size="small" @click="openAddressModal()">Thêm địa chỉ</NButton>
          </div>

          <div v-if="addresses.length > 0" class="mt-3 grid gap-2 sm:grid-cols-2">
            <div
              v-for="address in addresses"
              :key="address.id"
              class="relative rounded-xl p-3 text-left ring-1 transition"
              :class="address.id === selectedId ? 'bg-amber-50/70 ring-2 ring-amber-600' : 'bg-white ring-stone-200 hover:ring-amber-300'"
            >
              <button type="button" class="block w-full cursor-pointer text-left" @click="applyAddress(address)">
                <span class="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  {{ address.label || 'Địa chỉ' }}
                  <span v-if="address.isDefault" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Mặc định</span>
                </span>
                <span class="mt-1 block text-sm font-medium text-stone-900">{{ address.receiverName }} · {{ address.phone }}</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-stone-500">{{ address.address }}</span>
              </button>
              <button type="button" :aria-label="`Sửa địa chỉ ${address.label || address.address}`" class="absolute right-2 top-2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-stone-400 hover:bg-amber-50 hover:text-amber-700" @click="openAddressModal(address)">
                <NIcon :size="16"><PencilOutline /></NIcon>
              </button>
            </div>
          </div>
          <p v-else class="mt-3 rounded-xl border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-500">Chưa có địa chỉ nào. Thêm để đặt món nhanh hơn.</p>

          <div class="mt-4 grid gap-x-4 sm:grid-cols-2">
            <NFormItem label="Người nhận" path="receiverName" :rule="nameRules">
              <NInput v-model:value="form.receiverName" size="medium" />
            </NFormItem>
            <NFormItem label="Số điện thoại" path="phone" :rule="phoneRules">
              <NInput v-model:value="form.phone" placeholder="0900000000" inputmode="tel" size="medium" />
            </NFormItem>
            <NFormItem label="Địa chỉ nhận món" path="address" :rule="addressRules" class="sm:col-span-2">
              <NInput v-model:value="form.address" type="textarea" :autosize="{ minRows: 2 }" size="medium" />
            </NFormItem>
          </div>
        </section>

        <section class="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
          <h2 class="text-base font-bold text-stone-900">Thanh toán</h2>
          <NRadioGroup v-model:value="form.paymentMethod" class="mt-3 grid divide-y divide-stone-100">
            <NRadio value="COD" class="!m-0 w-full py-3">
              <span class="flex items-center gap-3">
                <NIcon :size="18" class="text-stone-500"><CashOutline /></NIcon>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-stone-900">Tiền mặt khi nhận</span>
                  <span class="mt-0.5 block text-xs leading-relaxed text-stone-500">Trả trực tiếp cho shipper khi nhận món.</span>
                </span>
              </span>
            </NRadio>
            <NRadio value="QR" class="!m-0 w-full py-3">
              <span class="flex items-center gap-3">
                <NIcon :size="18" class="text-stone-500"><QrCodeOutline /></NIcon>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-stone-900">Chuyển khoản QR</span>
                  <span class="mt-0.5 block text-xs leading-relaxed text-stone-500">Quét mã QR để điền sẵn số tiền và nội dung.</span>
                </span>
              </span>
            </NRadio>
          </NRadioGroup>
        </section>

        <section class="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
          <h2 class="text-base font-bold text-stone-900">Lưu ý cho quán</h2>
          <NInput v-model:value="form.note" class="mt-3" type="textarea" :autosize="{ minRows: 3 }" :maxlength="NOTE_MAX_LENGTH" show-count placeholder="Ví dụ: ít cay, không hành, gọi trước 10 phút" size="medium" />
          <div class="mt-2 flex items-center gap-1.5">
            <span class="shrink-0 text-xs text-stone-400">Gợi ý:</span>
            <div class="flex min-w-0 flex-wrap gap-1.5">
              <button v-for="s in NOTE_CHIPS" :key="s" type="button" class="cursor-pointer rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-amber-100 hover:text-amber-800" @click="addNote(s)">
                + {{ s }}
              </button>
            </div>
          </div>
        </section>
      </NForm>

      <!-- Cot tom tat sticky -->
      <aside class="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        <div class="rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="text-base font-bold text-stone-900">Đơn hàng của bạn</h2>
              <p class="mt-0.5 text-xs text-stone-500">{{ cart.items.length }} món · {{ totalQuantity }} phần</p>
            </div>
            <button type="button" class="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-amber-800 hover:underline" @click="ui.openDrawer('cart')">Sửa giỏ</button>
          </div>

          <div class="mt-3 space-y-2.5">
            <div v-for="item in cart.items.slice(0, 3)" :key="item.food?.id ?? item.quantity" class="flex items-center gap-2.5">
              <img :src="item.food?.imageUrl ?? ''" alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <span class="min-w-0 flex-1 truncate text-sm text-stone-700">
                <span class="font-semibold tabular-nums">{{ item.quantity }}x</span>
                {{ item.food?.name ?? 'Món' }}
              </span>
              <span v-if="quote" class="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                {{ formatVND(quote.lines.find(l => l.foodId === item.food?.id)?.lineTotal ?? 0) }}
              </span>
            </div>
            <p v-if="cart.items.length > 3" class="text-xs text-stone-400">+{{ cart.items.length - 3 }} món nữa</p>
          </div>

          <div class="mt-3 space-y-1.5 text-sm">
            <template v-if="quote">
              <div class="flex justify-between text-stone-600"><span>Tạm tính</span><span class="tabular-nums">{{ formatVND(quote.subtotal) }}</span></div>
              <div v-if="quote.discountTotal > 0" class="flex justify-between text-emerald-600"><span>Giảm giá</span><span class="tabular-nums">-{{ formatVND(quote.discountTotal) }}</span></div>
              <div class="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-base font-bold text-stone-900">
                <span>Tổng thanh toán</span>
                <span class="text-lg tabular-nums text-amber-800">{{ formatVND(quote.total) }}</span>
              </div>
            </template>
            <p v-else class="text-sm text-stone-500">{{ quoteError ? 'Không tính được giá, thử lại sau.' : 'Đang cập nhật giá…' }}</p>
            <p class="h-4 text-xs text-stone-500" aria-live="polite">{{ quoteStale ? 'Đang cập nhật giá…' : '' }}</p>
          </div>

          <NButton type="primary" size="large" strong block class="mt-2 hidden lg:flex" attr-type="submit" :form="CHECKOUT_FORM_ID" :loading="submitting || ordering" :disabled="!canSubmit">
            Xác nhận đặt món
          </NButton>
        </div>
      </aside>
    </div>

    <FormModal
      :title="editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'"
      :show="addressModal"
      :saving="savingAddress"
      :on-close="() => { addressModal = false }"
      :on-submit="submitAddress"
    >
      <NForm ref="addrFormRef" :model="addrForm" layout="vertical" :show-require-mark="false">
        <NFormItem label="Nhãn (ví dụ Nhà riêng, Cơ quan)" path="label">
          <NInput v-model:value="addrForm.label" placeholder="Ví dụ: Nhà riêng" maxlength="50" size="medium" />
        </NFormItem>
        <NFormItem label="Người nhận" path="receiverName" :rule="addrNameRules">
          <NInput v-model:value="addrForm.receiverName" size="medium" />
        </NFormItem>
        <NFormItem label="Số điện thoại" path="phone" :rule="addrPhoneRules">
          <NInput v-model:value="addrForm.phone" placeholder="0900000000" inputmode="tel" size="medium" />
        </NFormItem>
        <NFormItem label="Địa chỉ nhận món" path="address" :rule="addrAddressRules">
          <NInput v-model:value="addrForm.address" type="textarea" :autosize="{ minRows: 2 }" size="medium" />
        </NFormItem>
      </NForm>
    </FormModal>

    <!-- Thanh day mobile: tong tien va CTA duy nhat -->
    <div class="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden" :style="{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }">
      <div class="mx-auto flex max-w-3xl items-center gap-3">
        <div class="min-w-0 flex-1 text-sm">
          <span class="block text-xs text-stone-500">Tổng cộng</span>
          <span class="text-base font-bold tabular-nums text-amber-800">
            {{ quote ? formatVND(quote.total) : quoteError ? 'Lỗi tính giá' : 'Đang tính…' }}
          </span>
          <span v-if="quoteStale" class="ml-1 text-[11px] text-stone-500">đang cập nhật</span>
        </div>
        <NButton type="primary" size="large" strong attr-type="submit" :form="CHECKOUT_FORM_ID" :loading="submitting || ordering" :disabled="!canSubmit" class="shrink-0">
          Đặt món
        </NButton>
      </div>
    </div>
  </div>
</template>
