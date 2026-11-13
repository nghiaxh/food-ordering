<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NSkeleton } from 'naive-ui'
import { changePassword, getMe, updateMe } from '@/user/auth/api'
import useAsyncData from '@/composables/useAsyncData'
import { useAuthStore } from '@/user/auth/store'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { message } from '@/shared/api/message'
import FormModal from '@/components/FormModal.vue'
import type { FormItemRule } from 'naive-ui'

const auth = useAuthStore()
// Doc qua computed de the ho so cap nhat ngay khi auth store doi sau khi luu.
const user = computed(() => auth.user)
const saving = ref(false)
const changing = ref(false)
const passwordModal = ref(false)

const form = reactive({ fullName: user.value?.fullName ?? '', phone: '', address: '' })
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirm: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)
const passwordFormRef = ref<InstanceType<typeof NForm> | null>(null)

const { data: me, loading, error } = useAsyncData((signal) => getMe(signal), () => [])
watch(error, (e) => {
  if (e) message.error('Không tải được hồ sơ')
})
watch(me, (m) => {
  if (m) {
    form.fullName = m.fullName
    form.phone = m.phone
    form.address = m.address
  }
})

const phoneRules: FormItemRule[] = [
  { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] },
]
const passwordRules: FormItemRule[] = [
  { required: true, message: 'Nhập mật khẩu mới', trigger: ['blur', 'input'] },
  { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự', trigger: ['input'] },
]
const confirmRules: FormItemRule[] = [
  { required: true, message: 'Nhập lại mật khẩu mới', trigger: ['blur', 'input'] },
  {
    validator: (_rule, value: string) => (!value || value === passwordForm.newPassword ? true : new Error('Mật khẩu không khớp')),
    trigger: ['input', 'blur'],
  },
]

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  try {
    saving.value = true
    const updated = await updateMe({ fullName: form.fullName, phone: form.phone, address: form.address })
    // Dong bo ho ten sang header va the ho so; giu nguyen che do ghi nho dang co trong storage.
    if (auth.user) auth.setUser({ ...auth.user, fullName: updated.fullName }, Boolean(localStorage.getItem('auth')))
    message.success('Cập nhật hồ sơ thành công!')
  } catch {
    message.error('Cập nhật thất bại. Vui lòng thử lại.')
  } finally {
    saving.value = false
  }
}

const submitPassword = async () => {
  try {
    await passwordFormRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  try {
    changing.value = true
    await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
    message.success('Đổi mật khẩu thành công!')
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirm = ''
    passwordModal.value = false
  } catch {
    message.error('Không đổi được mật khẩu. Kiểm tra lại mật khẩu hiện tại.')
  } finally {
    changing.value = false
  }
}

const initial = computed(() => (user.value?.fullName ?? '?').charAt(0).toUpperCase())
const joinedLabel = computed(() =>
  me.value?.createdAt
    ? `Tham gia từ ${new Date(me.value.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
    : null,
)
</script>

<template>
  <div v-if="loading" class="mx-auto max-w-5xl px-3 py-6"><NSkeleton :repeat="4" height="72px" /></div>

  <div v-else class="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
    <div class="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <section class="rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200/60">
        <span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-700 text-2xl font-bold text-white">
          {{ initial }}
        </span>
        <p class="mt-3 text-base font-semibold text-stone-900">{{ user?.fullName }}</p>
        <p class="mt-0.5 break-all text-sm text-stone-500">{{ user?.email }}</p>
        <span class="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          {{ user?.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng' }}
        </span>
        <p v-if="joinedLabel" class="mt-2 text-xs text-stone-400">{{ joinedLabel }}</p>
      </section>

      <div class="space-y-5">
        <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
          <h2 class="text-base font-semibold text-stone-900">Thông tin cá nhân</h2>
          <NForm ref="formRef" :model="form" layout="vertical" :show-require-mark="false" class="mt-4" @submit.prevent="submit">
            <div class="grid gap-x-4 sm:grid-cols-2">
              <NFormItem label="Họ tên" path="fullName" :rule="[{ required: true, message: 'Nhập họ tên' }]">
                <NInput v-model:value="form.fullName" size="medium" />
              </NFormItem>
              <NFormItem label="Số điện thoại" path="phone" :rule="phoneRules">
                <NInput v-model:value="form.phone" placeholder="0900000000" size="medium" />
              </NFormItem>
            </div>
            <NFormItem label="Địa chỉ" path="address">
              <NInput v-model:value="form.address" size="medium" />
            </NFormItem>
            <div class="flex justify-end">
              <NButton type="primary" attr-type="submit" :loading="saving">Lưu thay đổi</NButton>
            </div>
          </NForm>
        </section>

        <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
          <div>
            <h2 class="text-base font-semibold text-stone-900">Bảo mật</h2>
            <p class="mt-0.5 text-sm text-stone-500">Đổi mật khẩu đăng nhập của bạn.</p>
          </div>
          <NButton @click="passwordModal = true">Đổi mật khẩu</NButton>
        </section>
      </div>
    </div>

    <FormModal
      title="Đổi mật khẩu"
      :show="passwordModal"
      :saving="changing"
      :on-close="() => { passwordModal = false }"
      :on-submit="submitPassword"
    >
      <p class="mb-4 text-sm text-stone-500">Mật khẩu gồm 8 ký tự trở lên. Email không thay đổi được, liên hệ quản trị viên nếu cần.</p>
      <NForm ref="passwordFormRef" :model="passwordForm" layout="vertical" :show-require-mark="false">
        <NFormItem label="Mật khẩu hiện tại" path="currentPassword" :rule="[{ required: true, message: 'Nhập mật khẩu hiện tại' }]">
          <NInput v-model:value="passwordForm.currentPassword" type="password" autocomplete="current-password" show-password-on="click" size="medium" />
        </NFormItem>
        <NFormItem label="Mật khẩu mới" path="newPassword" :rule="passwordRules">
          <NInput v-model:value="passwordForm.newPassword" type="password" autocomplete="new-password" size="medium" />
        </NFormItem>
        <NFormItem label="Nhập lại mật khẩu mới" path="confirm" :rule="confirmRules">
          <NInput v-model:value="passwordForm.confirm" type="password" autocomplete="new-password" size="medium" @keyup.enter="submitPassword" />
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
