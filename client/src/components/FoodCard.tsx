import { message } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Food } from '../types'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import { foodChips } from '../utils/food-tags'
import UiImg from './UiImg'
import UiButton from './UiButton'

/** Chỉ hiện 2 nhãn đầu: thẻ món phải còn chỗ cho giá và nút, thêm nhãn chỉ làm loãng. */
const MAX_CHIPS = 2

const MENU_SCROLL_KEY = 'menu-scroll'

/**
 * Thẻ món của bảng món kiosk. Cả thẻ mở trang chi tiết; nút "Thêm vào giỏ" luôn hiện để
 * khách vãng lai vẫn thấy hành động và được mời đăng nhập thay vì gặp một thẻ trống nút.
 *
 * Ảnh 16:10 giữ mật độ cũ (2 cột mobile, 4 cột từ `md`). Tên hai dòng thay vì cắt một dòng,
 * giá giảm đứng trước giá gốc để so sánh được ngay.
 */
export default function FoodCard({ food }: { food: Food }) {
  const add = useCartStore((s) => s.add)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const from = `${location.pathname}${location.search}`
  const unit = food.discountedPrice ?? food.price

  const openDetail = () => {
    const scroller = document.querySelector<HTMLElement>('.kiosk-scroll')
    if (scroller) sessionStorage.setItem(MENU_SCROLL_KEY, String(scroller.scrollTop))
    navigate(`/foods/${food.id}`, { state: { from } })
  }

  const handleAdd = async () => {
    if (!food.available) return
    if (!user) {
      message.info('Đăng nhập để thêm món vào giỏ')
      navigate('/login', {
        state: { from: { pathname: location.pathname, search: location.search } },
      })
      return
    }
    const ok = await add(food)
    if (ok) message.success(`Đã thêm ${food.name} vào giỏ`)
  }

  return (
    <div
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-lg"
      // Cả thẻ là vùng mở chi tiết; bỏ qua khi cú bấm rơi vào liên kết hoặc nút bên trong.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return
        openDetail()
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Link
          to={`/foods/${food.id}`}
          state={{ from }}
          onClick={() => {
            const scroller = document.querySelector<HTMLElement>('.kiosk-scroll')
            if (scroller) sessionStorage.setItem(MENU_SCROLL_KEY, String(scroller.scrollTop))
          }}
          className="block h-full w-full"
          aria-label={`Xem chi tiết ${food.name}`}
        >
          <UiImg
            src={food.imageUrl}
            alt={food.name}
            className={`h-full w-full transition duration-300 group-hover:scale-105 ${
              food.available ? '' : 'grayscale'
            }`}
          />
        </Link>
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
          {!food.available && (
            <span className="rounded-full bg-stone-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
              Hết món
            </span>
          )}
          {food.available && !!food.discountPercent && (
            <span className="rounded-full bg-amber-700 px-2 py-0.5 text-[11px] font-semibold text-white">
              -{food.discountPercent}%
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <Link
          to={`/foods/${food.id}`}
          state={{ from }}
          onClick={() => {
            const scroller = document.querySelector<HTMLElement>('.kiosk-scroll')
            if (scroller) sessionStorage.setItem(MENU_SCROLL_KEY, String(scroller.scrollTop))
          }}
          className="min-h-0"
        >
          <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-stone-900 group-hover:text-amber-800 sm:text-sm">
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

        <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-2 sm:pt-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-base font-bold tabular-nums text-amber-800 sm:text-lg">
                {formatVND(unit)}
              </span>
              {unit < food.price && (
                <span className="text-xs tabular-nums text-stone-500 line-through">
                  {formatVND(food.price)}
                </span>
              )}
            </div>
            {food.discountLabel && unit < food.price && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-700">{food.discountLabel}</p>
            )}
          </div>

          <UiButton
            kind="primary"
            size="small"
            className="w-full !px-2.5 !text-xs sm:w-auto"
            disabled={!food.available}
            onClick={() => void handleAdd()}
          >
            {food.available ? 'Thêm vào giỏ' : 'Tạm hết'}
          </UiButton>
        </div>
      </div>
    </div>
  )
}
