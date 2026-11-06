import type { Category } from '../../types'
import UiIcon from '../UiIcon'
import UiImg from '../UiImg'

interface CategoryRailProps {
  categories: Category[]
  activeId?: number
  onPick: (id?: number) => void
}

/**
 * Dải danh mục dạng chip có ảnh tròn: cao 36px, cuộn ngang trên mobile. Cùng ngôn ngữ với
 * hàng chip bộ lọc bên dưới nên trang chỉ còn hai hàng điều khiển thay vì ba, và ảnh danh
 * mục trong DB vẫn được dùng làm điểm nhận diện.
 */
export default function CategoryRail({ categories, activeId, onPick }: CategoryRailProps) {
  if (categories.length === 0) return null

  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition ${
      active ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  return (
    <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button type="button" onClick={() => onPick()} className={chip(activeId === undefined)}>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
            activeId === undefined ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-500'
          }`}
        >
          <UiIcon name="th-large" size={14} />
        </span>
        Tất cả
      </button>

      {categories.map((category) => {
        const active = activeId === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onPick(category.id)}
            title={category.description || category.name}
            aria-pressed={active}
            className={chip(active)}
          >
            <UiImg src={category.imageUrl} alt="" className="h-7 w-7 rounded-full" />
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
