import { Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { foodChips } from '../utils/food-tags'
import UiImg from './UiImg'

/**
 * Hàng món dọc, dùng ở chế độ danh sách của trang Thực đơn. Ưu tiên tên, giá và
 * tối đa 2 chip; mô tả dài chỉ để dành cho dạng lưới để hàng không cao.
 */
export default function FoodRow({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)
  const chips = foodChips(food).slice(0, 2)

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-stone-200/60 sm:gap-4 sm:p-3">
      <Link to={`/foods/${food.id}`} className="shrink-0">
        <UiImg
          src={food.imageUrl}
          alt={food.name}
          className={`h-16 w-16 rounded-xl sm:h-20 sm:w-20 ${food.available ? '' : 'grayscale'}`}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/foods/${food.id}`}
          className="block truncate font-medium text-stone-900 transition hover:text-amber-700"
        >
          {food.name}
        </Link>
        <div className="mt-0.5 font-semibold tabular-nums text-amber-700">{formatVND(food.price)}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}
            >
              {chip.label}
            </span>
          ))}
          {!food.available && (
            <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              Tạm hết
            </span>
          )}
        </div>
      </div>

      <Button
        type="primary"
        shape="circle"
        size="large"
        aria-label={`Thêm ${food.name} vào giỏ`}
        icon={<PlusOutlined />}
        disabled={!food.available}
        onClick={() => {
          add(food)
          message.success('Đã thêm vào giỏ')
        }}
      />
    </div>
  )
}
