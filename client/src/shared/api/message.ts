import { createDiscreteApi } from 'naive-ui'
import { ADMIN_THEME_OVERRIDES } from '@/shared/theme'

// createDiscreteApi cho dung toast/dialog ca ngoai setup(), khong can provider boc.
export const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { themeOverrides: ADMIN_THEME_OVERRIDES },
})
