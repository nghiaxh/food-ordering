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
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-50 ring-1 ring-stone-100">
        <span aria-hidden="true" className="text-xl leading-none">
          🍜
        </span>
      </span>
      <span className="hidden text-[15px] font-bold tracking-tight text-stone-900 sm:inline">
        FoodOrdering
      </span>
    </Link>
  )
}
