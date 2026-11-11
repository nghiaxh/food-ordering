<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NInput, NIcon } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { adminUploadImage } from '@/admin/menu/api'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'

interface Props {
  value?: string
  label?: string
}
const props = withDefaults(defineProps<Props>(), { label: 'URL ß║ónh', value: '' })
const emit = defineEmits<{ 'update:value': [value: string] }>()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Chon tep de tai len may chu, hoac dan URL ngoai; server kiem chu ky file that.
const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    message.error('ß║ónh v╞░ß╗út qu├í 2 MB')
    input.value = ''
    return
  }
  try {
    uploading.value = true
    const { url } = await adminUploadImage(file)
    emit('update:value', url)
    message.success('─É├ú tß║úi ß║únh l├¬n')
  } catch (error) {
    message.error(apiErrorMessage(error) ?? 'Tß║úi ß║únh thß║Ñt bß║íi')
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <div>
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <label class="mb-1.5 block text-xs font-medium text-stone-400">{{ props.label }}</label>
        <NInput :value="props.value ?? ''" clearable placeholder="https://..." size="medium" @update:value="(v: string) => emit('update:value', v)" />
      </div>
      <NButton :loading="uploading" @click="fileInput?.click()">
        <template #icon><NIcon :size="16"><CloudUploadOutline /></NIcon></template>
        Chß╗ìn ß║únh
      </NButton>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
    </div>
    <div class="mt-2">
      <img v-if="props.value" :src="props.value" alt="Xem tr╞░ß╗¢c ß║únh" class="aspect-[4/3] w-full max-w-xs rounded-xl border border-stone-100 object-cover" />
      <div v-else class="grid aspect-[4/3] w-full max-w-xs place-items-center rounded-xl border border-dashed border-stone-200 text-stone-300">
        <span class="text-xs">Ch╞░a c├│ ß║únh</span>
      </div>
    </div>
  </div>
</template>
