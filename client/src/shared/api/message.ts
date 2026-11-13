import { createDiscreteApi } from 'naive-ui'
import { ADMIN_THEME_OVERRIDES } from '@/shared/theme'

// Toast dung duoc ca trong store lan ngoai component ma khong can provider boc;
// App.vue van giu NMessageProvider/NDialogProvider rieng cho useMessage/useDialog trong setup().
// Dialog xac nhan xoa chi dung o khu quan tri nen doi mau chu dam cho trung voi trang do.
export const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { themeOverrides: ADMIN_THEME_OVERRIDES },
})
