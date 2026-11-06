import type { ThemeConfig } from 'antd'

/**
 * Token AntD dùng chung cho khách và quản trị. Màu chính là hổ phách đậm `#b45309`
 * thay vì `#d97706`: chữ trắng trên nền này đạt tương phản AA, còn màu sáng chỉ dùng
 * cho logo và điểm nhấn lớn.
 */
const theme: ThemeConfig = {
  token: {
    colorPrimary: '#b45309',
    borderRadius: 12,
    controlHeight: 40,
    fontFamily: 'Inter Variable, sans-serif',
    // Đồng bộ breakpoint AntD với Tailwind (640/768/1024/1280)
    screenSM: 640,
    screenMD: 768,
    screenLG: 1024,
    screenXL: 1280,
  },
}

export default theme
