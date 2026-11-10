<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { NButton, NForm, NFormItem, NInput, NIcon } from 'naive-ui'
import { EyeOffOutline, EyeOutline } from '@vicons/ionicons5'
import { register } from '@/modules/auth/api'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { message } from '@/shared/api/message'
import AuthShell from '@/modules/auth/components/AuthShell.vue'
import type { FormItemRule } from 'naive-ui'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)

const form = reactive({ fullName: '', email: '', phone: '', address: '', password: '', confirm: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const fullNameRules: FormItemRule[] = [{ required: true, message: 'Vui lòng nhập họ tên', trigger: ['blur', 'input'] }]
const emailRules: FormItemRule[] = [
  { required: true, message: 'Vui lòng nhập email', trigger: ['blur', 'input'] },
  { type: 'email', message: 'Email không hợp lệ', trigger: ['blur', 'input'] },
]
const phoneRules: FormItemRule[] = [
  { pattern: PHONE_PATTERN, message: 'Số điện thoại phải gồm đúng 10 chữ số', trigger: ['input'] },
]
const passwordRules: FormItemRule[] = [
  { required: true, message: 'Vui lòng nhập mật khẩu', trigger: ['blur', 'input'] },
  { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự', trigger: ['input'] },
]
const confirmRules: FormItemRule[] = [
  { required: true, message: 'Vui lòng nhập lại mật khẩu', trigger: ['blur', 'input'] },
  {
    validator: (_rule, value: string) =>
      !value || value === form.password ? true : new Error('Mật khẩu không khớp'),
    trigger: ['input', 'blur'],
  },
]

const onSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  try {
    loading.value = true
    await register({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      address: form.address || undefined,
      password: form.password,
    })
    message.success('Đăng ký thành công! Vui lòng đăng nhập.')
    router.push('/login')
  } catch (error) {
    message.error(apiErrorMessage(error) ?? 'Đăng ký không thành công')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Đăng ký" max-width="max-w-[440px]">
    <NForm ref="formRef" :model="form" layout="vertical" :show-require-mark="false" @submit.prevent="onSubmit">
      <NFormItem label="Họ tên" path="fullName" :rule="fullNameRules">
        <NInput v-model:value="form.fullName" placeholder="Nguyễn Văn A" autocomplete="name" size="medium" />
      </NFormItem>
      <div class="grid gap-x-3 sm:grid-cols-2">
        <NFormItem label="Email" path="email" :rule="emailRules">
          <NInput v-model:value="form.email" placeholder="ban@example.com" autocomplete="email" size="medium" />
        </NFormItem>
        <NFormItem label="Số điện thoại" path="phone" :rule="phoneRules">
          <NInput v-model:value="form.phone" placeholder="0900000000" autocomplete="tel" size="medium" />
        </NFormItem>
      </div>
      <NFormItem label="Địa chỉ" path="address">
        <NInput v-model:value="form.address" placeholder="Quận 1, TP. HCM" autocomplete="street-address" size="medium" />
      </NFormItem>
      <NFormItem label="Mật khẩu" path="password" :rule="passwordRules">
        <NInput
          v-model:value="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          autocomplete="new-password"
          size="medium"
        >
          <template #suffix>
            <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-stone-400 hover:text-stone-600" :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" @click="showPassword = !showPassword">
              <NIcon :size="18"><EyeOffOutline v-if="showPassword" /><EyeOutline v-else /></NIcon>
            </button>
          </template>
        </NInput>
      </NFormItem>
      <NFormItem label="Nhập lại mật khẩu" path="confirm" :rule="confirmRules">
        <NInput
          v-model:value="form.confirm"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          autocomplete="new-password"
          size="medium"
          @keyup.enter="onSubmit"
        />
      </NFormItem>
      <NButton type="primary" size="large" attr-type="submit" strong block :loading="loading">
        Đăng ký
      </NButton>
    </NForm>

    <p class="mt-4 text-center text-sm text-stone-500">
      Đã có tài khoản?
      <RouterLink to="/login" class="font-semibold text-amber-700 hover:underline">Đăng nhập</RouterLink>
    </p>
  </AuthShell>
</template>
