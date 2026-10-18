import { message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { foodChips } from '../utils/food-tags'
import UiImg from './UiImg'
import UiButton from './UiButton'

/** Chỉ hiện 2 nhãn đầu: thẻ món phải còn chỗ cho giá và nút, thêm nhãn chỉ làm loãng. */
const MAX_CHIPS = 2

/**
 * Thẻ món của bảng món kiosk. Nút phải có nhãn "Thêm vào giỏ" vì Bảng 2.22 quy định rõ
 * thành phần này; nút tròn không gọi tên được hành động. Món hết món giữ nguyên nhãn
 * "Hết món" và nút ở trạng thái không bấm được.
 *
 * Ảnh cắt theo 16:10 thay cho 4:3 để thẻ thấp hơn, nhìn thấy được nhiều món hơn trên
 * cùng một màn hình. Hàng giá và nút dùng `flex-wrap` nên thẻ hẹp sẽ xuống dòng thay vì tràn.
 */
export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:shadow-lg">
      <Link
        to={`/foods/${food.id}`}
        className="relative block aspect-[16/10] overflow-hidden"
        aria-label={`Xem chi tiết ${food.name}`}
      >
        <UiImg
          src={food.imageUrl}
          alt={food.name}
          className={`h-full w-full transition duration-300 group-hover:scale-105 ${
            food.available ? '' : 'grayscale'
          }`}
        />
        {!food.available && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-stone-900/75 px-2 py-0.5 text-[11px] font-semibold text-white">
            Hết món
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link to={`/foods/${food.id}`} className="min-h-0">
          <h3 className="truncate text-sm font-semibold text-stone-900 group-hover:text-amber-700">
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
            icon={<PlusOutlined />}
            disabled={!food.available}
            onClick={() => {
              add(food)
              message.success(`Đã thêm ${food.name} vào giỏ`)
            }}
          >
            {food.available ? 'Thêm vào giỏ' : 'Hết món'}
          </UiButton>
        </div>
      </div>
    </div>
  )
}