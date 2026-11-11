<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NSkeleton } from 'naive-ui'
import { changePassword, getMe, updateMe } from '@/user/auth/api'
import useAsyncData from '@/composables/useAsyncData'
import { useAuthStore } from '@/user/auth/store'
import { PHONE_PATTERN } from '@/shared/utils/validators'
import { message } from '@/shared/api/message'
import FormModal from '@/components/FormModal.vue'
import type { FormItemRule } from 'naive-ui'

const auth = useAuthStore()
const user = auth.user
const saving = ref(false)
const changing = ref(false)
const passwordModal = ref(false)

const form = reactive({ fullName: user?.fullName ?? '', phone: '', address: '' })
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirm: '' })
const formRef = ref<InstanceType<typeof NForm> | null>(null)
const passwordFormRef = ref<InstanceType<typeof NForm> | null>(null)

const { data: me, loading, error } = useAsyncData((signal) => getMe(signal), () => [])
watch(error, (e) => {
  if (e) message.error('Kh├┤ng tß║úi ─æ╞░ß╗úc hß╗ô s╞í')
})
watch(me, (m) => {
  if (m) {
    form.fullName = m.fullName
    form.phone = m.phone
    form.address = m.address
  }
})

const phoneRules: FormItemRule[] = [
  { pattern: PHONE_PATTERN, message: 'Sß╗æ ─æiß╗çn thoß║íi phß║úi gß╗ôm ─æ├║ng 10 chß╗» sß╗æ', trigger: ['input'] },
]
const passwordRules: FormItemRule[] = [
  { required: true, message: 'Nhß║¡p mß║¡t khß║⌐u mß╗¢i', trigger: ['blur', 'input'] },
  { min: 8, message: 'Mß║¡t khß║⌐u phß║úi c├│ ├¡t nhß║Ñt 8 k├╜ tß╗▒', trigger: ['input'] },
]
const confirmRules: FormItemRule[] = [
  { required: true, message: 'Nhß║¡p lß║íi mß║¡t khß║⌐u mß╗¢i', trigger: ['blur', 'input'] },
  {
    validator: (_rule, value: string) => (!value || value === passwordForm.newPassword ? true : new Error('Mß║¡t khß║⌐u kh├┤ng khß╗¢p')),
    trigger: ['input', 'blur'],
  },
]

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('Vui l├▓ng nhß║¡p ─æß║ºy ─æß╗º th├┤ng tin')
    return
  }
  try {
    saving.value = true
    await updateMe({ fullName: form.fullName, phone: form.phone, address: form.address })
    message.success('Cß║¡p nhß║¡t hß╗ô s╞í th├ánh c├┤ng!')
  } catch {
    message.error('Cß║¡p nhß║¡t thß║Ñt bß║íi. Vui l├▓ng thß╗¡ lß║íi.')
  } finally {
    saving.value = false
  }
}

const submitPassword = async () => {
  try {
    await passwordFormRef.value?.validate()
  } catch {
    message.error('Vui l├▓ng nhß║¡p ─æß║ºy ─æß╗º th├┤ng tin')
    return
  }
  try {
    changing.value = true
    await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
    message.success('─Éß╗òi mß║¡t khß║⌐u th├ánh c├┤ng!')
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirm = ''
    passwordModal.value = false
  } catch {
    message.error('Kh├┤ng ─æß╗òi ─æ╞░ß╗úc mß║¡t khß║⌐u. Kiß╗âm tra lß║íi mß║¡t khß║⌐u hiß╗çn tß║íi.')
  } finally {
    changing.value = false
  }
}

const initial = (user?.fullName ?? '?').charAt(0).toUpperCase()
const joinedLabel = me.value?.createdAt
  ? `Tham gia tß╗½ ${new Date(me.value.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
  : null
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
          {{ user?.role === 'ADMIN' ? 'Quß║ún trß╗ï vi├¬n' : 'Kh├ích h├áng' }}
        </span>
        <p v-if="joinedLabel" class="mt-2 text-xs text-stone-400">{{ joinedLabel }}</p>
      </section>

      <div class="space-y-5">
        <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
          <h2 class="text-base font-semibold text-stone-900">Th├┤ng tin c├í nh├ón</h2>
          <NForm ref="formRef" :model="form" layout="vertical" :show-require-mark="false" class="mt-4" @submit.prevent="submit">
            <div class="grid gap-x-4 sm:grid-cols-2">
              <NFormItem label="Hß╗ì t├¬n" path="fullName" :rule="[{ required: true, message: 'Nhß║¡p hß╗ì t├¬n' }]">
                <NInput v-model:value="form.fullName" size="medium" />
              </NFormItem>
              <NFormItem label="Sß╗æ ─æiß╗çn thoß║íi" path="phone" :rule="phoneRules">
                <NInput v-model:value="form.phone" placeholder="0900000000" size="medium" />
              </NFormItem>
            </div>
            <NFormItem label="─Éß╗ïa chß╗ë" path="address">
              <NInput v-model:value="form.address" size="medium" />
            </NFormItem>
            <div class="flex justify-end">
              <NButton type="primary" attr-type="submit" :loading="saving">L╞░u thay ─æß╗òi</NButton>
            </div>
          </NForm>
        </section>

        <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200/60 sm:p-6">
          <div>
            <h2 class="text-base font-semibold text-stone-900">Bß║úo mß║¡t</h2>
            <p class="mt-0.5 text-sm text-stone-500">─Éß╗òi mß║¡t khß║⌐u ─æ─âng nhß║¡p cß╗ºa bß║ín.</p>
          </div>
          <NButton @click="passwordModal = true">─Éß╗òi mß║¡t khß║⌐u</NButton>
        </section>
      </div>
    </div>

    <FormModal
      title="─Éß╗òi mß║¡t khß║⌐u"
      :show="passwordModal"
      :saving="changing"
      :on-close="() => { passwordModal = false }"
      :on-submit="submitPassword"
    >
      <p class="mb-4 text-sm text-stone-500">Mß║¡t khß║⌐u gß╗ôm 8 k├╜ tß╗▒ trß╗ƒ l├¬n. Email kh├┤ng thay ─æß╗òi ─æ╞░ß╗úc, li├¬n hß╗ç quß║ún trß╗ï vi├¬n nß║┐u cß║ºn.</p>
      <NForm ref="passwordFormRef" :model="passwordForm" layout="vertical" :show-require-mark="false">
        <NFormItem label="Mß║¡t khß║⌐u hiß╗çn tß║íi" path="currentPassword" :rule="[{ required: true, message: 'Nhß║¡p mß║¡t khß║⌐u hiß╗çn tß║íi' }]">
          <NInput v-model:value="passwordForm.currentPassword" type="password" autocomplete="current-password" show-password-on="click" size="medium" />
        </NFormItem>
        <NFormItem label="Mß║¡t khß║⌐u mß╗¢i" path="newPassword" :rule="passwordRules">
          <NInput v-model:value="passwordForm.newPassword" type="password" autocomplete="new-password" size="medium" />
        </NFormItem>
        <NFormItem label="Nhß║¡p lß║íi mß║¡t khß║⌐u mß╗¢i" path="confirm" :rule="confirmRules">
          <NInput v-model:value="passwordForm.confirm" type="password" autocomplete="new-password" size="medium" @keyup.enter="submitPassword" />
        </NFormItem>
      </NForm>
    </FormModal>
  </div>
</template>
