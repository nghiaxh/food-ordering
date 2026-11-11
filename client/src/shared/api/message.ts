import { createDiscreteApi } from 'naive-ui'

// Toast dung duoc ca trong store lan ngoai component ma khong can provider boc;
// App.vue van giu NMessageProvider/NDialogProvider rieng cho useMessage/useDialog trong setup().
export const { message, dialog } = createDiscreteApi(['message', 'dialog'])
