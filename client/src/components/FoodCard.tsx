import { message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import type { Food } from '../types'
import { useAuthStore } from '../store/authStore'
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
 * cùng một màn hình. Dưới `sm` (thẻ ~150px ở màn 360px) giá và nút xếp dọc, nút rộng hết
 * thẻ để không tràn ngang; từ `sm` trở lên chúng quay lại một hàng.
 */
export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // Khách chưa đăng nhập thì ẩn nút thêm món; món hết vẫn hiện để báo trạng thái.
  const canAdd = user !== null

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
          className={`h-full w-full transition duration-300 group-hover:scale-105 ${
            food.available ? '' : 'grayscale'
          }`}
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

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <Link to={`/foods/${food.id}`} className="min-h-0">
          <h3 className="truncate text-[13px] font-semibold text-stone-900 group-hover:text-amber-700 sm:text-sm">
            {food.name}
          </h3>
        </Link>

        <div className="mt-1 flex flex-wrap gap-1 sm:mt-1.5">
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

        <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:pt-2.5">
          {food.discountedPrice != null && food.discountedPrice < food.price ? (
            <div className="min-w-0">
              <div className="text-base font-bold tabular-nums text-amber-700 sm:text-lg">
                {formatVND(food.discountedPrice)}
              </div>
              <div className="text-xs tabular-nums text-stone-400 line-through">{formatVND(food.price)}</div>
            </div>
          ) : (
            <div className="text-base font-bold tabular-nums text-amber-700 sm:text-lg">
              {formatVND(food.price)}
            </div>
          )}
          {(canAdd || !food.available) && (
            <UiButton
              kind="primary"
              size="small"
              className="!px-2.5 !text-xs w-full sm:w-auto"
              disabled={!food.available}
              onClick={() => {
                add(food)
                message.success(`Đã thêm ${food.name} vào giỏ`)
              }}
            >
              {food.available ? 'Thêm vào giỏ' : 'Hết món'}
            </UiButton>
          )}
        </div>
      </div>
    </div>
  )
}