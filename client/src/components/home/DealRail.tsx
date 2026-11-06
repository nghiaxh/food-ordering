import { Link } from 'react-router-dom'
import type { Food } from '../../types'
import { formatVND } from '../../utils/format'
import UiImg from '../UiImg'

interface DealRailProps {
  foods: Food[]
  /** Vị trí thực đơn để trang chi tiết quay lại đúng bộ lọc. */
  from: string
  onSeeAll: () => void
}

/**
 * Ưu đãi lấy từ `discountPercent` server đã tính, không tự đoán khuyến mãi nào đang chạy.
 * Hiển thị thành dải cuộn ngang để đọc ra là gợi ý, không phải lưới món thứ hai giống hệt
 * phần thực đơn bên dưới.
 */
export default function DealRail({ foods, from, onSeeAll }: DealRailProps) {
  if (foods.length === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold tracking-tight text-stone-900 sm:text-lg">Ưu đãi hôm nay</h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Tự động
          </span>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-amber-800 hover:underline"
        >
          Xem tất cả
        </button>
      </div>

      <div className="-mx-1 mt-2 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {foods.map((food) => {
          const unit = food.discountedPrice ?? food.price
          return (
            <Link
              key={food.id}
              to={`/foods/${food.id}`}
              state={{ from }}
              className="group w-[200px] shrink-0 snap-start overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/70 transition hover:shadow-md sm:w-[220px]"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <UiImg
                  src={food.imageUrl}
                  alt={food.name}
                  className="h-full w-full transition duration-300 group-hover:scale-105"
                />
                {!!food.discountPercent && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    -{food.discountPercent}%
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-semibold text-stone-900">{food.name}</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-sm font-bold tabular-nums text-amber-800">{formatVND(unit)}</span>
                  <span className="text-[11px] tabular-nums text-stone-500 line-through">
                    {formatVND(food.price)}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
