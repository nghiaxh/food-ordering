import { MinusOutlined, PlusOutlined } from '@ant-design/icons'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}

/**
 * Bộ chọn số lượng dùng chung cho giỏ, checkout và trang chi tiết món. Nút luôn là vùng
 * chạm 36/44px, có nhãn cho trình đọc màn hình; không dùng InputNumber vì ô nhập số mời
 * người dùng gõ số âm hoặc số quá lớn.
 */
export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = 'md',
  label = 'Số lượng',
}: QuantityStepperProps) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const text = size === 'sm' ? 'w-8 text-sm' : 'w-10 text-base'
  const btn =
    'flex cursor-pointer items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div
      className="flex shrink-0 items-center overflow-hidden rounded-full ring-1 ring-stone-200"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Giảm số lượng"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${box} ${btn} rounded-l-full`}
      >
        <MinusOutlined style={{ fontSize: size === 'sm' ? 10 : 12 }} />
      </button>
      <span className={`${text} text-center font-semibold tabular-nums text-stone-900`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Tăng số lượng"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${box} ${btn} rounded-r-full`}
      >
        <PlusOutlined style={{ fontSize: size === 'sm' ? 10 : 12 }} />
      </button>
    </div>
  )
}
