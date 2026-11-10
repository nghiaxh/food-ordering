import { createDiscreteApi } from 'naive-ui'

// Toast dùng được cả trong store lẫn ngoài component mà không cần provider bọc;
// App.vue vẫn giữ NMessageProvider riêng cho useMessage trong setup().
export const { message } = createDiscreteApi(['message'])
