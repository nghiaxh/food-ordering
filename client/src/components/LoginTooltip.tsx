import { Tooltip } from 'antd'
import type { MouseEvent, ReactNode } from 'react'

export const LOGIN_TO_ADD_HINT = 'Đăng nhập để thêm món vào giỏ'

interface LoginTooltipProps {
  active: boolean
  /** Nút nằm trong một liên kết thì phải chặn cả điều hướng, không chỉ chặn nổi bọt sự kiện. */
  blockLink?: boolean
  children: ReactNode
}

/**
 * Bọc nút thêm món khi khách chưa đăng nhập. AntD Button disabled không phát sự kiện chuột
 * nên tooltip bám vào span bên ngoài; `tabIndex` giữ cho bàn phím vẫn focus và thấy gợi ý.
 * `pointer-events-none` trên nút disabled để chuột rơi xuống span, nếu không hover sẽ không mở.
 */
export default function LoginTooltip({ active, blockLink, children }: LoginTooltipProps) {
  if (!active) return <>{children}</>

  return (
    <Tooltip title={LOGIN_TO_ADD_HINT} trigger={['hover', 'focus']}>
      <span
        className="inline-flex cursor-not-allowed [&>button:disabled]:pointer-events-none"
        tabIndex={0}
        onClick={(e: MouseEvent) => {
          e.stopPropagation()
          if (blockLink) e.preventDefault()
        }}
      >
        {children}
      </span>
    </Tooltip>
  )
}
