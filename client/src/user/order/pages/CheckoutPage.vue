<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NConfigProvider,
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  NEmpty,
  NIcon,
  NSkeleton,
  NTag,
} from 'naive-ui'
import {
  CashOutline,
  QrCodeOutline,
  PencilOutline,
} from '@vicons/ionicons5'
import { createOrder, getAddresses, saveAddress } from '@/user/order/api'
import useAsyncAction from '@/composables/useAsyncAction'
import useCartQuote from '@/composables/useCartQuote'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import type { SavedAddress } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import FormModal from '@/components/FormModal.vue'
import type { FormItemRule, GlobalThemeOverrides } from 'naive-ui'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255
const NOTE_SUGGESTIONS = ['Ít cay', 'Không hành', 'Gọi trước 10 phút']

/** Theme chung cua app la amber; trang dat mon dung orange cua Tailwind trong pham vi nay. */
const checkoutTheme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ea580c',
    primaryColorHover: '#c2410c',
    primaryColorPressed: '#9a3412',
    primaryColorSuppl: '#ea580c',
  },
}

/** Naive chi nhan mau tag qua prop nen dung dung bac orange cua Tailwind. */
const DEFAULT_TAG_COLOR = { color: '#fff7ed', textColor: '#c2410c' }

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
const selectedId = ref<number | null>(null)
const addressModal = ref(false)
const editingAddress = ref<SavedAddress | null>(null)
const savingAddress = ref(false)
let addressCtrl: AbortController | undefined

const form = reactive({ receiverName: auth.user?.fullName ?? '', phone: '', address: '', note: '', paymentMethod: 'COD' })
const addrForm = reactive({ label: '', receiverName: '', phone: '', address: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)
const addrFormRef = ref<InstanceType<typeof NForm> | null>(null)

const { quote, quoteLoading, quoteError, quoteStale, retry: retryQuote } = useCartQuote(() => cart.items)

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

/** Tai lai danh sach dia chi; huy request cu de response muon khong thang lan tai sau. */
const loadAddresses = async () => {
  addressCtrl?.abort()
  const ctrl = new AbortController()
  addressCtrl = ctrl
  try {
    addresses.value = await getAddresses(ctrl.signal)
  } catch (error) {
    // Huy request do roi trang hoac tai lai khong phai loi. Loi mang thi giu danh sach dang
    // co; chi bao khi chua co gi de dung nen form go tay la cach duy nhat.
    if ((error as { code?: string })?.code === 'ERR_CANCELED') return
    if (addresses.value.length === 0) message.error('Không tải được địa chỉ đã lưu')
  }
}

onMounted(() => {
  if (!auth.user) return
  void loadAddresses()
})
onBeforeUnmount(() => addressCtrl?.abort())

const applyAddress = (address: SavedAddress) => {
  selectedId.value = address.id
  form.receiverName = address.receiverName
  form.phone = address.phone
  form.address = address.address
}

// Danh sach doi (nap xong, luu dia chi moi, server doi mac dinh): chon lai mac dinh khi
// lua chon cu khong con trong danh sach. Dia chi con ton tai thi giu nguyen de khong
// ghi de phan khach da sua tay cho rieng don nay.
watch(addresses, (list) => {
  if (list.some((a) => a.id === selectedId.value)) return
  const def = list.find((a) => a.isDefault) ?? list[0]
  if (def) applyAddress(def)
  else selectedId.value = null
})

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

/**
 * Chuoi dinh danh gio: doi mon hoac doi so luong deu lam chuoi doi. Dung de biet bao gia
 * con dung voi gio hien tai va gio co bi doi trong luc cho server tao don hay khong.
 */
const signatureOf = (rows: { foodId: number | null; quantity: number }[]) =>
  rows
    .filter((r) => r.foodId != null)
    .map((r) => `${r.foodId}x${r.quantity}`)
    .sort()
    .join('|')

const cartRows = () =>
  cart.items.filter((i) => i.food).map((i) => ({ foodId: i.food!.id, quantity: i.quantity }))

const quoteSignature = computed(() => (quote.value ? signatureOf(quote.value.lines) : ''))

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
  const rows = cartRows()
  const signature = signatureOf(rows)
  // Bao gia phai dung voi gio dang hien thi; lech nghia la gia tren man hinh da cu.
  if (signature !== quoteSignature.value) {
    message.warning('Giỏ hàng vừa thay đổi, đang cập nhật lại giá. Vui lòng kiểm tra rồi đặt lại.')
    retryQuote()
    return
  }
  ordering.value = true
  const res = await submitOrder({
    items: rows,
    receiverName: form.receiverName,
    phone: form.phone,
    address: form.address,
    paymentMethod: form.paymentMethod,
    note: form.note.trim() || undefined,
  })
  ordering.value = false
  if (res.ok) {
    // Gio doi trong luc cho server: don da tao theo ban chup truoc do, xoa gio se mat mon vua them.
    if (signatureOf(cartRows()) === signature) {
      await cart.clear()
      message.success('Đặt món thành công')
    } else {
      message.warning('Đơn đã được tạo nhưng giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại giỏ.')
      await cart.load()
    }
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
  <NConfigProvider :theme-overrides="checkoutTheme">
    <div v-if="!cart.loaded" class="mx-auto max-w-4xl px-4 py-8"><NSkeleton :repeat="6" height="40px" /></div>

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

    <div v-else class="mx-auto max-w-4xl px-3 py-4 pb-28 sm:px-6 lg:pb-8">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-4">
        <!-- Form thong tin giao hang + thanh toan + ghi chu -->
        <NForm :id="CHECKOUT_FORM_ID" ref="formRef" :model="form" layout="vertical" :show-require-mark="false" @submit.prevent="checkout">
          <NCard size="small" :bordered="false" class="!rounded-2xl ring-1 ring-stone-200/60">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-stone-900">Thông tin giao hàng</span>
                <NButton size="tiny" quaternary type="primary" @click="openAddressModal()">Thêm địa chỉ</NButton>
              </div>
            </template>

            <div v-if="addresses.length > 0" class="grid gap-2 sm:grid-cols-2">
              <div
                v-for="address in addresses"
                :key="address.id"
                class="relative rounded-xl p-2.5 text-left ring-1 transition"
                :class="address.id === selectedId ? 'bg-orange-50 ring-orange-500' : 'bg-white ring-stone-200 hover:ring-orange-300'"
              >
                <button type="button" class="block w-full cursor-pointer border-0 bg-transparent p-0 pr-7 text-left" @click="applyAddress(address)">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[11px] font-semibold text-orange-700">{{ address.label || 'Địa chỉ' }}</span>
                    <NTag v-if="address.isDefault" size="tiny" :bordered="false" :color="DEFAULT_TAG_COLOR">Mặc định</NTag>
                  </span>
                  <span class="mt-1 block truncate text-xs font-medium text-stone-900">{{ address.receiverName }} · {{ address.phone }}</span>
                  <span class="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-stone-500">{{ address.address }}</span>
                </button>
                <NButton size="tiny" quaternary circle :aria-label="`Sửa địa chỉ ${address.label || address.address}`" class="absolute right-1.5 top-1.5" @click="openAddressModal(address)">
                  <template #icon><NIcon :size="14"><PencilOutline /></NIcon></template>
                </NButton>
              </div>
            </div>
            <p v-else class="rounded-lg border border-dashed border-stone-200 px-2.5 py-2 text-[11px] text-stone-500">Chưa có địa chỉ nào. Thêm để đặt món nhanh hơn.</p>

            <div class="mt-3 grid gap-x-3 sm:grid-cols-2">
              <NFormItem label="Người nhận" path="receiverName" :rule="nameRules" class="!mb-3">
                <NInput v-model:value="form.receiverName" size="medium" />
              </NFormItem>
              <NFormItem label="Số điện thoại" path="phone" :rule="phoneRules" class="!mb-3">
                <NInput v-model:value="form.phone" placeholder="0900000000" inputmode="tel" size="medium" />
              </NFormItem>
              <NFormItem label="Địa chỉ nhận món" path="address" :rule="addressRules" class="!mb-0 sm:col-span-2">
                <NInput v-model:value="form.address" type="textarea" :autosize="{ minRows: 2 }" size="medium" />
              </NFormItem>
            </div>
          </NCard>

          <NCard size="small" :bordered="false" class="mt-3 !rounded-2xl ring-1 ring-stone-200/60">
            <template #header>
              <span class="text-sm font-semibold text-stone-900">Thanh toán</span>
            </template>
            <NRadioGroup v-model:value="form.paymentMethod" class="grid divide-y divide-stone-100">
              <NRadio value="COD" class="!m-0 w-full py-2.5">
                <span class="flex items-center gap-2.5">
                  <NIcon :size="16" class="shrink-0 text-orange-600"><CashOutline /></NIcon>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-stone-900">Tiền mặt khi nhận</span>
                    <span class="mt-0.5 block text-[11px] leading-relaxed text-stone-500">Trả trực tiếp cho shipper khi nhận món.</span>
                  </span>
                </span>
              </NRadio>
              <NRadio value="QR" class="!m-0 w-full py-2.5">
                <span class="flex items-center gap-2.5">
                  <NIcon :size="16" class="shrink-0 text-orange-600"><QrCodeOutline /></NIcon>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-stone-900">Chuyển khoản QR</span>
                    <span class="mt-0.5 block text-[11px] leading-relaxed text-stone-500">Quét mã QR để điền sẵn số tiền và nội dung.</span>
                  </span>
                </span>
              </NRadio>
            </NRadioGroup>
          </NCard>

          <NCard size="small" :bordered="false" class="mt-3 !rounded-2xl ring-1 ring-stone-200/60">
            <template #header>
              <span class="text-sm font-semibold text-stone-900">Lưu ý cho quán</span>
            </template>
            <NInput v-model:value="form.note" type="textarea" :autosize="{ minRows: 2 }" :maxlength="NOTE_MAX_LENGTH" show-count placeholder="Ví dụ: ít cay, không hành, gọi trước 10 phút" size="medium" />
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="shrink-0 text-[11px] text-stone-400">Gợi ý:</span>
              <NButton v-for="s in NOTE_CHIPS" :key="s" size="tiny" round quaternary type="primary" @click="addNote(s)">
                + {{ s }}
              </NButton>
            </div>
          </NCard>
        </NForm>

        <!-- Cot tom tat sticky -->
        <aside class="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <NCard size="small" :bordered="false" class="!rounded-2xl ring-1 ring-stone-200/60">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-stone-900">Đơn hàng của bạn</h2>
                <p class="mt-0.5 text-[11px] text-stone-500">{{ cart.items.length }} món · {{ totalQuantity }} phần</p>
              </div>
              <NButton size="tiny" text type="primary" class="shrink-0" @click="ui.openDrawer('cart')">Sửa giỏ</NButton>
            </div>

            <div class="mt-2.5 space-y-2">
              <div v-for="item in cart.items.slice(0, 3)" :key="item.food?.id ?? item.quantity" class="flex items-center gap-2">
                <img :src="item.food?.imageUrl ?? ''" alt="" class="h-9 w-9 shrink-0 rounded-md object-cover" />
                <span class="min-w-0 flex-1 truncate text-xs text-stone-700">
                  <span class="font-semibold tabular-nums">{{ item.quantity }}x</span>
                  {{ item.food?.name ?? 'Món' }}
                </span>
                <span v-if="quote" class="shrink-0 text-xs font-semibold tabular-nums text-stone-900">
                  {{ formatVND(quote.lines.find(l => l.foodId === item.food?.id)?.lineTotal ?? 0) }}
                </span>
              </div>
              <p v-if="cart.items.length > 3" class="text-[11px] text-stone-400">+{{ cart.items.length - 3 }} món nữa</p>
            </div>

            <div class="mt-2.5 space-y-1 text-xs">
              <template v-if="quote">
                <div class="flex justify-between text-stone-600"><span>Tạm tính</span><span class="tabular-nums">{{ formatVND(quote.subtotal) }}</span></div>
                <div v-if="quote.discountTotal > 0" class="flex justify-between text-emerald-600"><span>Giảm giá</span><span class="tabular-nums">-{{ formatVND(quote.discountTotal) }}</span></div>
                <div class="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-sm font-semibold text-stone-900">
                  <span>Tổng thanh toán</span>
                  <span class="text-base tabular-nums text-orange-700">{{ formatVND(quote.total) }}</span>
                </div>
              </template>
              <p v-else class="text-stone-500">{{ quoteError ? 'Không tính được giá, thử lại sau.' : 'Đang cập nhật giá…' }}</p>
              <p class="h-3 text-[11px] text-stone-500" aria-live="polite">{{ quoteStale ? 'Đang cập nhật giá…' : '' }}</p>
            </div>

            <NButton type="primary" size="large" strong block class="mt-1 hidden lg:flex" attr-type="submit" :form="CHECKOUT_FORM_ID" :loading="submitting || ordering" :disabled="!canSubmit">
              Xác nhận đặt món
            </NButton>
          </NCard>
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
          <div class="min-w-0 flex-1">
            <span class="block text-[11px] text-stone-500">Tổng cộng</span>
            <span class="text-base font-bold tabular-nums text-orange-700">
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
  </NConfigProvider>
</template>
