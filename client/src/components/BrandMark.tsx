import { Link } from 'react-router-dom'

/**
 * Nhận diện của quán trong thanh điều hướng. Logo thay nút "Trang chủ" cũ, bấm là về
 * thực đơn. Dưới `sm` chỉ giữ biểu tượng để ô tìm kiếm còn chỗ, header vẫn một hàng.
 */
export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="FoodOrdering, về trang chủ"
      className={`flex shrink-0 cursor-pointer items-center gap-2 ${className}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-700 text-white shadow-sm">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
          <path
            d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8Z"
            fill="currentColor"
            opacity=".95"
          />
          <path
            d="M7 7c0-1.2 1-1.5 1-2.5M11 7c0-1.2 1-1.5 1-2.5M15 7c0-1.2 1-1.5 1-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M9 11c.6 2.4 5.4 2.4 6 0" stroke="#fef3c7" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="hidden text-[15px] font-bold tracking-tight text-stone-900 sm:inline">
        FoodOrdering
      </span>
    </Link>
  )
}
