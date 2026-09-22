import { Button, Tag, message } from 'antd'
import { ShoppingCartOutlined } from '@ant-design/icons'
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
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
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
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{food.description}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-amber-700">{formatVND(food.price)}</div>
            <div className="mt-1 text-xs text-stone-400">
              {SPICY[food.spicyLevel]} · Phục vụ {food.servingSize} người
              {food.spicyLevel > 0 && (
                <Tag className="ml-1" color="red" style={{ marginInlineEnd: 0 }}>
                  ớt {food.spicyLevel}/3
                </Tag>
              )}
            </div>
          </div>
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