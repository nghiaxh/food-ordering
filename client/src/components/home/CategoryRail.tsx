import type { Category } from '../../types'
import UiIcon from '../UiIcon'
import UiImg from '../UiImg'

interface CategoryRailProps {
  categories: Category[]
  activeId?: number
  onPick: (id?: number) => void
}

/**
 * Dải danh mục có ảnh, dùng `Category.imageUrl` sẵn có trong DB. Trước đây ảnh danh mục
 * không được dùng ở đâu; rail này là điểm nhận diện chính của trang chủ.
 * Cuộn ngang và bám từng ô trên mobile, đủ 6 ô trên desktop.
 */
export default function CategoryRail({ categories, activeId, onPick }: CategoryRailProps) {
  if (categories.length === 0) return null

  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onPick()}
        className="flex w-16 shrink-0 snap-start cursor-pointer flex-col items-center gap-1.5 sm:w-20"
      >
        <span
          className={`grid h-14 w-14 place-items-center rounded-2xl transition sm:h-16 sm:w-16 ${
            activeId === undefined
              ? 'bg-amber-700 text-white ring-2 ring-amber-700 ring-offset-2'
              : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-amber-50'
          }`}
        >
          <UiIcon name="th-large" size={22} />
        </span>
        <span className="line-clamp-1 text-[11px] font-medium text-stone-700 sm:text-xs">Tất cả</span>
      </button>

      {categories.map((category) => {
        const active = activeId === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onPick(category.id)}
            title={category.description || category.name}
            className="flex w-16 shrink-0 snap-start cursor-pointer flex-col items-center gap-1.5 sm:w-20"
          >
            <UiImg
              src={category.imageUrl}
              alt=""
              className={`h-14 w-14 rounded-2xl transition sm:h-16 sm:w-16 ${
                active ? 'ring-2 ring-amber-700 ring-offset-2' : 'ring-1 ring-stone-200 hover:ring-amber-300'
              }`}
            />
            <span
              className={`line-clamp-1 text-[11px] sm:text-xs ${
                active ? 'font-semibold text-amber-800' : 'font-medium text-stone-700'
              }`}
            >
              {category.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
