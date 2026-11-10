<script setup lang="ts">
import { NModal, NButton } from 'naive-ui'

interface Props {
  title: string
  show: boolean
  saving?: boolean
  width?: number
  onClose: () => void
  onSubmit: () => void
}
const props = withDefaults(defineProps<Props>(), { saving: false, width: 460 })
</script>

<template>
  <!-- Modal chứa Form: bấm Lưu vẫn chạy form.submit() qua onSubmit; các hộp biểu mẫu đều có cùng nút Lưu/Hủy + loading. -->
  <NModal :show="props.show" preset="card" :title="props.title" :style="{ width: `${props.width}px`, maxWidth: '95vw' }" @update:show="(v: boolean) => !v && props.onClose()">
    <slot />
    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton @click="props.onClose">Hủy</NButton>
        <NButton type="primary" :loading="props.saving" @click="props.onSubmit">Lưu</NButton>
      </div>
    </template>
  </NModal>
</template>
