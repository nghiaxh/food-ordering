import type { Food } from '../../types'
import FoodCard from '../FoodCard'

interface DealRailProps {
  foods: Food[]
  onSeeAll: () => void
}

/**
 * Ưu đãi lấy từ `discountPercent` server đã tính, không tự đoán khuyến mãi nào đang chạy.
 * Dùng chung thẻ món với lưới thực đơn nên hai nơi giống nhau hoàn toàn, khách thêm nhanh
 * được ngay trong dải này.
 */
export default function DealRail({ foods, onSeeAll }: DealRailProps) {
  if (foods.length === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold tracking-tight text-stone-900 sm:text-lg">Ưu đãi hôm nay</h2>
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
        {foods.map((food) => (
          <div key={food.id} className="w-[200px] shrink-0 snap-start sm:w-[220px]">
            <FoodCard food={food} />
          </div>
        ))}
      </div>
    </section>
  )
}
