import { message } from 'antd'
import { Link } from 'react-router-dom'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)

  return (
    <div className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-1 hover:shadow-lg">
      <Link to={`/foods/${food.id}`} className="relative block h-44 overflow-hidden">
        <img
          src={food.imageUrl}
          alt={food.name}
          className={`h-full w-full transition duration-300 group-hover:scale-105 ${food.available ? '' : 'grayscale'}`}
        />
        {food.category && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-stone-700 backdrop-blur">
            {food.category.name}
          </span>
        )}
        {!food.available && (
          <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">
            Tạm hết
          </span>
        )}
      </Link>

      <div className="p-4">
        <Link to={`/foods/${food.id}`}>
          <h3 className="truncate text-base font-semibold text-stone-900 group-hover:text-amber-700">
            {food.name}
          </h3>
        </Link>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {foodChips(food)
            .slice(0, MAX_CHIPS)
            .map((chip) => (
              <span
                key={chip.label}
                className={`whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-medium ${chip.className}`}
              >
                {chip.label}
              </span>
            ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-2.5">
          <div className="text-lg font-bold tabular-nums text-amber-700">{formatVND(food.price)}</div>
          <UiButton
            kind="primary"
            className="!px-3 !text-sm"
            disabled={!food.available}
            onClick={() => {
              add(food)
              message.success('Đã thêm vào giỏ')
            }}
          />
        </div>
      </div>
    </div>
  )
}