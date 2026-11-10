// Toast dùng được cả trong store lẫn ngoài component mà không cần provider bọc;
// App.vue vẫn giữ NMessageProvider/NDialogProvider riêng cho useMessage/useDialog trong setup().
import { createDiscreteApi } from 'naive-ui'

export const { message, dialog } = createDiscreteApi(['message', 'dialog'])
