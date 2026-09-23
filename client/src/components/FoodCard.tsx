import { Button, message } from 'antd'
import { ShoppingCartOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import UiImg from './UiImg'

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)

  const chips = [
    food.category?.name,
    SPICY[food.spicyLevel],
    `${food.servingSize} người`,
    ...(food.dietaryTags ? food.dietaryTags.split(',').map((t) => t.trim()).filter(Boolean) : []),
  ].filter(Boolean) as string[]

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-1 hover:shadow-lg">
      <Link to={`/foods/${food.id}`} className="relative block aspect-[4/3] overflow-hidden">
        <UiImg
          src={food.imageUrl}
          alt={food.name}
          className={`transition duration-300 group-hover:scale-105 ${food.available ? '' : 'grayscale'}`}
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/foods/${food.id}`}>
          <h3 className="truncate text-base font-semibold text-stone-900 group-hover:text-amber-700">
            {food.name}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{food.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
            >
              {chip}
            </span>
          ))}
          {!food.available && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              Tạm hết
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="text-lg font-bold text-amber-700">{formatVND(food.price)}</div>
          <Button
            type="primary"
            shape="circle"
            icon={<ShoppingCartOutlined />}
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