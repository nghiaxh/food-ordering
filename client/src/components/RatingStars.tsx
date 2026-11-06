import { useState } from 'react'
import { StarFilled, StarOutlined } from '@ant-design/icons'

interface RatingStarsProps {
  value: number
  onChange?: (value: number) => void
  size?: number
  disabled?: boolean
  className?: string
}

export default function RatingStars({
  value,
  onChange,
  size = 16,
  disabled = false,
  className = '',
}: RatingStarsProps) {
  const [hovered, setHovered] = useState(0)
  const interactive = Boolean(onChange) && !disabled
  const active = hovered > 0 ? hovered : Math.max(0, Math.min(5, value))

  if (!interactive) {
    // Chế độ chỉ đọc không dựng nút: tránh nút lồng trong nút khi đặt cạnh một liên kết
    // hoặc tiêu đề bấm được, và sao hiển thị không nhận focus vô nghĩa.
    return (
      <span
        role="img"
        aria-label={`${active} trên 5 sao`}
        className={`inline-flex items-center gap-0.5 ${className}`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} aria-hidden="true" className="leading-none">
            {star <= active ? (
              <StarFilled style={{ fontSize: size }} className="text-amber-500" />
            ) : (
              <StarOutlined style={{ fontSize: size }} className="text-stone-300" />
            )}
          </span>
        ))}
      </span>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Đánh giá sao"
      className={`inline-flex items-center gap-0.5 ${className}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-label={`${star} trên 5 sao`}
          aria-checked={value === star}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange?.(star)}
          className="cursor-pointer border-0 bg-transparent p-0 leading-none transition-transform duration-150 hover:scale-110 active:scale-90"
        >
          {star <= active ? (
            <StarFilled style={{ fontSize: size }} className="text-amber-500" />
          ) : (
            <StarOutlined style={{ fontSize: size }} className="text-stone-300" />
          )}
        </button>
      ))}
    </div>
  )
}