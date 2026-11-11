<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { NCheckbox, NForm, NFormItem, NInput, NButton, NIcon } from 'naive-ui'
import { EyeOffOutline, EyeOutline } from '@vicons/ionicons5'
import { login } from '@/user/auth/api'
import { useAuthStore } from '@/user/auth/store'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import AuthShell from '@/user/auth/components/AuthShell.vue'
import type { FormItemRule } from 'naive-ui'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const remember = ref(true)

const form = reactive({ email: '', password: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)

const showPassword = ref(false)
const emailRules: FormItemRule[] = [{ required: true, message: 'Vui lòng nhập email', trigger: ['blur', 'input'] }]
const passwordRules: FormItemRule[] = [{ required: true, message: 'Vui lòng nhập mật khẩu', trigger: ['blur', 'input'] }]

const onSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui lòng nhập đầy đủ thông tin')
    return
  }
  try {
    loading.value = true
    const data = await login(form.email, form.password)
    auth.setUser(data, remember.value)
    const state = history.state as { from?: { pathname?: string; search?: string }; openCart?: boolean } | null
    const from = state?.from
    // Giu ca query de quay lai dung bo loc thuc don, va giu co mo gio neu khach bam gio truoc.
    const returnTo = from?.pathname && from.pathname !== '/login' ? `${from.pathname}${from.search ?? ''}` : '/'
    const target = data.role === 'ADMIN' ? '/admin' : returnTo
    message.success('Đăng nhập thành công!')
    router.replace({ path: target, state: state?.openCart ? { openCart: true } : undefined })
  } catch (error) {
    message.error(apiErrorMessage(error) ?? 'Đăng nhập thất bại')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Đăng nhập">
    <NForm ref="formRef" :model="form" layout="vertical" :show-require-mark="false" @submit.prevent="onSubmit">
      <NFormItem label="Email" path="email" :rule="emailRules">
        <NInput v-model:value="form.email" placeholder="ban@example.com" autocomplete="username" size="medium" />
      </NFormItem>
      <NFormItem label="Mật khẩu" path="password" :rule="passwordRules">
        <NInput
          v-model:value="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          autocomplete="current-password"
          size="medium"
          @keyup.enter="onSubmit"
        >
          <template #suffix>
            <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-stone-400 hover:text-stone-600" :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" @click="showPassword = !showPassword">
              <NIcon :size="18"><EyeOffOutline v-if="showPassword" /><EyeOutline v-else /></NIcon>
            </button>
          </template>
        </NInput>
      </NFormItem>
      <div class="mb-3 -mt-3">
        <NCheckbox v-model:checked="remember"><span class="text-sm text-stone-600">Ghi nhớ đăng nhập</span></NCheckbox>
      </div>
      <NButton type="primary" size="large" attr-type="submit" strong block :loading="loading">
        Đăng nhập
      </NButton>
    </NForm>

    <p class="mt-4 text-center text-sm text-stone-500">
      Chưa có tài khoản?
      <RouterLink to="/register" class="font-semibold text-amber-700 hover:underline">Đăng ký ngay</RouterLink>
    </p>
  </AuthShell>
</template>
