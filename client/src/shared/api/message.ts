import { createDiscreteApi } from 'naive-ui'
import { ADMIN_THEME_OVERRIDES } from '@/shared/theme'

// createDiscreteApi cho dung toast/dialog ca ngoai setup(), khong can provider boc.
export const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { themeOverrides: ADMIN_THEME_OVERRIDES },
  // Gioi hang doi de bam nhanh khong chen man hinh; naive-ui bo toast cu nhat khi qua 3.
  messageProviderProps: { max: 3 },
})
