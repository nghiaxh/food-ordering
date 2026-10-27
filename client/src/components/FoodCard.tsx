import { message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)
  const navigate = useNavigate()

  return (
    <div
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:shadow-lg"
      // Cả thẻ là vùng bấm mở chi tiết; bỏ qua khi cú bấm rơi vào liên kết hoặc nút bên trong
      // để không mở panel hai lần hay thêm món nhầm.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return
        navigate(`/foods/${food.id}`)
      }}
    >
      <Link
        to={`/foods/${food.id}`}
        className="relative block aspect-[16/10] overflow-hidden"
        aria-label={`Xem chi tiết ${food.name}`}
      >
        <UiImg
          src={food.imageUrl}
          alt={food.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          {!food.available && (
            <span className="rounded-full bg-stone-900/75 px-2 py-0.5 text-[11px] font-semibold text-white">
              Hết món
            </span>
          )}
          {food.available && !!food.discountPercent && (
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              -{food.discountPercent}%
            </span>
          )}
          {food.available && !!food.discountLabel && (
            <span className="rounded-full bg-amber-50/95 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 backdrop-blur">
              {food.discountLabel}
            </span>
          )}
        </div>
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
          {food.discountedPrice != null && food.discountedPrice < food.price ? (
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums text-amber-700">{formatVND(food.discountedPrice)}</div>
              <div className="text-xs tabular-nums text-stone-400 line-through">{formatVND(food.price)}</div>
            </div>
          ) : (
            <div className="text-lg font-bold tabular-nums text-amber-700">{formatVND(food.price)}</div>
          )}
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