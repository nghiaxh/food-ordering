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

  return (
    <div
      role={interactive ? 'radiogroup' : undefined}
      aria-label="Đánh giá sao"
      className={`inline-flex items-center gap-0.5 ${className}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role={interactive ? 'radio' : undefined}
          aria-label={`${star} trên 5 sao`}
          aria-checked={interactive ? value === star : undefined}
          disabled={!interactive}
          onMouseEnter={interactive ? () => setHovered(star) : undefined}
          onMouseLeave={interactive ? () => setHovered(0) : undefined}
          onClick={interactive ? () => onChange?.(star) : undefined}
          className={`border-0 bg-transparent p-0 leading-none ${
            interactive ? 'cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90' : 'cursor-default'
          }`}
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